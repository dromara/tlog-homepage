---
title: WebFlux、WebClient 与响应式上下文
permalink: /guide/webflux
description: 'WebFlux 和 WebClient 使用 Reactor Context 隔离请求，了解线程切换、网关转发与传播边界。'
---

# WebFlux、WebClient 与响应式上下文

TLog 2.0 的最终实现已经使用 **Reactor Context + 上下文快照**隔离请求，并通过命名 operator hook 在 Reactor 订阅和信号回调中临时恢复 TLog 自身的 ThreadLocal 与 MDC 字段。它不是只在入口线程设置一次 ThreadLocal 的旧实现，也不要求额外引入 Micrometer context-propagation。

## 普通 WebFlux 应用

保留应用自己的 WebFlux starter，加入 TLog Web starter：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
<dependency>
    <groupId>com.yomahub</groupId>
    <artifactId>tlog-web-spring-boot-starter</artifactId>
    <version>2.0.0</version>
</dependency>
```

TLog 按应用类型装配普通 WebFlux Filter。无需为了 TLog 再引入 Servlet Web starter；同时引入 MVC 与 WebFlux 时，应先确认 Boot 实际选中了哪种应用类型。

普通 WebFlux 入口保留收到的请求头，在自己的上下文中建立 trace/span。首次 WebClient 出站才生成第一个子 span，典型关系为 `0 → 0.1`。Gateway、Soul、ShenYu 的真实转发模式另外处理，避免普通服务提前改写入站头或消耗子 span。

## 使用容器中的 WebClient.Builder

TLog 自动装饰的是 **Builder Bean**。如果应用已经由 Boot 提供 Builder，直接注入并构造客户端即可：

```java
@Bean
public WebClient contextClient(WebClient.Builder builder) {
    return builder.baseUrl("http://127.0.0.1:18081").build();
}
```

Boot 4 将客户端自动配置拆分到相应客户端 starter。若应用没有 Builder Bean，可以引入所需客户端 starter，或显式声明一个供 TLog 装饰：

```java
@Bean
public WebClient.Builder webClientBuilder() {
    return WebClient.builder();
}
```

不要在同一个 Bean 方法里 `WebClient.builder().build()` 后，就假设中间的临时 Builder 已经过 BeanPostProcessor。手工构造时明确安装：

```java
import com.yomahub.tlog.webflux.client.TLogWebClientFilter;

WebClient client = WebClient.builder()
        .filter(new TLogWebClientFilter())
        .build();
```

`WebClient` 属于 Spring WebFlux；“TLog 的纯 Java 客户端无需 Spring”指的是 HttpClient、OkHttp、Hutool、Forest 等其它适配器。

## 在订阅时读取上下文

WebClient 过滤器在订阅时优先读取当前 Reactor Context。一个 Publisher 若由不同请求订阅，不应把组装它时某个线程的 trace 固定给所有订阅者。

```java
public Mono<String> callDownstream(WebClient client) {
    return Mono.defer(() -> {
        log.info("开始请求下游");
        return client.get()
                .uri("/api/context?probe=reactive-manual")
                .retrieve()
                .bodyToMono(String.class);
    }).delayElement(Duration.ofMillis(10))
      .publishOn(Schedulers.parallel())
      .doOnNext(body -> log.info("处理下游结果"));
}
```

`Mono`、`Schedulers` 来自 Reactor，`Duration` 来自 `java.time`。这段逻辑应由 WebFlux 订阅并留在同一响应式链中，不要在控制器内另起一个无人管理的 `subscribe()` 作为替代。

## 开关

```yaml
tlog:
  enabled: true
  w3c-trace-context: true
  web:
    enabled: true
    response-header: true
  http-client:
    enabled: true
```

`web.enabled` 控制入口，`http-client.enabled` 控制 Builder 的自动装饰；手工添加的过滤器仍由应用管理。响应头开关关闭 `tlogTraceId` 回写。

没有 TLog traceId 时可以沿用合法 `traceparent` 的 trace-id。TLog 仍使用自己的层级 spanId，不等于完整 W3C 传播或 OpenTelemetry span 导出，详见[兼容性说明](/guide/compatibility#w3c-与其它边界)。

## 验证与限制

库级兼容验证覆盖 Reactor 3.1、3.4、3.8 的上下文隔离、错误、取消、继承状态和 fusion。真实 demo 覆盖 Boot 2.7/3.5/4.0 的 defer、delay、subscribeOn、publishOn、WebClient 跨进程调用，以及真实客户端断连取消后的下一请求恢复。

TLog 注册的 hook 名为 `com.yomahub.tlog.context`。不要在应用运行期间清除它；需要重置全部 Reactor hooks 的测试应使用独立 JVM，避免把仍在运行的桥接一并移除。

应用自有的任意 ThreadLocal 或业务 MDC 不在这套 Reactor 桥接的传播保证内。

原生线程、未包装的外部执行器，以及脱离当前响应式链的手工订阅，不会因“入口用了 WebFlux”就自动具备正确上下文。仍需显式包装或传递。Hook 也有操作符包装和上下文恢复成本，不能承诺固定性能损耗比例。

可以直接运行[示例的一键验收](/guide/examples)，观察 Gateway → WebFlux → HTTP 三进程中 trace 保持一致、span 按 `0 → 0.1 → 0.1.1` 递进。
