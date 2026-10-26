---
title: 配置参考
permalink: /guide/configuration
description: 'TLog 2.0 配置默认值、开关作用域、自定义 ID 生成器和异步执行器配置。'
---

# 配置参考

以下配置适用于 Spring Boot 自动装配。新文档使用 kebab-case，旧 camelCase 写法仍可通过 Spring relaxed binding 绑定。IDE 提示来自产物中的 `spring-configuration-metadata.json`。

## 配置表

| 配置项 | 默认值 | 作用 |
| --- | --- | --- |
| `tlog.enabled` | `true` | 自动埋点总开关；统一传播器与 Dubbo/Dubbox SPI 同样遵守 |
| `tlog.pattern` | `<$spanId><$traceId>` | 完整日志标签模板，未设置时使用此格式 |
| `tlog.enable-invoke-time-print` | `false` | Web / Dubbo 参数及耗时日志 |
| `tlog.id-generator` | 未设置 | 自定义 `TLogIdGenerator` 实现的全类名 |
| `tlog.mdc-enable` | 未设置 | 设为 `true` 时，告知消息适配器标签已由 MDC 输出，避免重复追加 |
| `tlog.w3c-trace-context` | `true` | 无 TLog traceId 时尝试复用合法 traceparent 的 trace-id |
| `tlog.web.enabled` | `true` | Servlet、WebFlux 和网关入口自动配置 |
| `tlog.web.response-header` | `true` | 本节点是否回写 `tlogTraceId` 响应头 |
| `tlog.web.order` | `-2147483647` | Servlet Filter 顺序；默认在字符编码过滤器之后 |
| `tlog.async.enabled` | `true` | Spring 管理执行器的自动装饰 |
| `tlog.http-client.enabled` | `true` | 容器 HTTP 客户端的自动装饰 |
| `tlog.scheduled.enabled` | `true` | Spring `@Scheduled` 的 TLog 切面 |
| `tlog.kafka.enabled` | `true` | Spring Kafka 生产者工厂与监听容器的 header 透传 |
| `tlog.rabbitmq.enabled` | `true` | Spring AMQP `RabbitTemplate` 与监听容器的 header 透传 |

`tlog.mdc-enable` 不是“是否写 MDC”的总开关。TLog 入口会写入 `tl`、`tlogTraceId` 等字段；该属性为 `true` 时只控制消息适配器不要再次拼接标签。设置为 `false` 也不会清空 MDC。

## 常用配置

```yaml
spring:
  application:
    name: order-service

tlog:
  enabled: true
  pattern: '<$spanId><$traceId>'
  enable-invoke-time-print: false
  mdc-enable: true
  w3c-trace-context: true
  web:
    enabled: true
    response-header: true
    order: -2147483647
  async:
    enabled: true
  http-client:
    enabled: true
  scheduled:
    enabled: true
  kafka:
    enabled: true
  rabbitmq:
    enabled: true
```

这份示例采用 MDC 日志输出；如果使用 TLog encoder 自动在消息前追加标签，不要照搬 `mdc-enable: true`，应与自己的日志 pattern 一起选择。

`spring.application.name` 不配置时为 `NONE`。模板的全部占位符见[标签模板](/pages/239d32/)。

## 开关的范围

- 总开关关闭自动埋点和统一传播，但保留读取运行配置的轻量组件。它不卸载日志配置，也不撤销应用显式调用的核心 API。
- `async.enabled=false` 不再自动装饰 Spring 执行器；显式调用 `TLogExecutors.wrap` 仍表示需要传播。
- `http-client.enabled=false` 不再自动装饰容器中的 RestTemplate、WebClient.Builder、RestClient.Builder；不会删除用户手工安装的拦截器。
- `scheduled.enabled` 针对 Spring `@Scheduled`。用户显式继承的 JDK Timer/Quartz 任务类属于另一路接入。
- `web.response-header=false` 控制本节点回写，不负责删除下游已经返回的同名头。多跳网关链路应按各节点的需要分别设置。
- `web.order` 只调整 Servlet Filter，不能把它移到字符编码过滤器之前并继续期待表单编码行为不变。
- `kafka.enabled`、`rabbitmq.enabled` 只针对 Spring 容器中的组件。原生客户端里显式配置的 `TLogKafkaProducerInterceptor`、`TLogRabbitHeaders.inject` 仍受总开关 `tlog.enabled` 控制。

## 自定义 ID 生成器 Bean

```java
import com.yomahub.tlog.id.TLogIdGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.UUID;

@Configuration
public class TraceIdConfiguration {
    @Bean
    public TLogIdGenerator tlogIdGenerator() {
        return new TLogIdGenerator() {
            @Override
            public String generateTraceId() {
                return UUID.randomUUID().toString().replace("-", "");
            }
        };
    }
}
```

唯一候选 Bean 优先于 `tlog.id-generator` 全类名配置；多个候选时可用 `@Primary`。没有合适的自定义生成器时使用默认生成器。生成器返回的 ID 应适合日志和传播头，并由应用的生成策略保证所需的唯一性。

读取请求扩展数据时，新实现使用 `getExtData()`。旧 `extData` 字段和手工链式调用的边界见[升级指南](/guide/upgrade#配置与扩展点)。

## Spring 异步执行器

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfiguration {
    @Bean("businessExecutor")
    public ThreadPoolTaskExecutor businessExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("business-");
        return executor;
    }
}
```

将业务方法放在另一个 Spring Bean 上，以 `@Async("businessExecutor")` 通过代理调用。TLog 自动装饰这个 Bean，捕获提交时的 TLog 和 MDC；已有 TaskDecorator 会组合保留。用户 decorator 应在 Bean 初始化前设置，初始化后再次替换会覆盖 TLog 的组合结果。

外部线程池、默认 CompletableFuture 执行器和周期任务的行为见[线程池](/pages/a69e1d/)；响应式链路使用[Reactor 上下文](/guide/webflux)。

## 非 Spring 应用

Spring Boot 配置文件不会自动作用于纯 Java 程序。设置应用名和传播总开关可使用：

```java
TLogRuntime.setAppName("batch-client");
TLogRuntime.setEnabled(true);
```

入口建立、日志输出、客户端拦截器与线程传播仍需按场景配置。可直接运行[纯 Java 示例](/guide/examples#纯-java-客户端)验证 classpath 中没有 Spring 时的行为。
