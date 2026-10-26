---
title: 从 1.x 升级到 2.0
permalink: /guide/upgrade
description: '从 TLog 1.x 迁移到 2.0：依赖、移除项、日志、异步、配置和 API 兼容说明。'
---

# 从 1.x 升级到 2.0

TLog 2.0 使用同一套 starter 适配 Boot 2、3、4，所有模块统一为 `2.0.0`。

## 统一依赖版本

把项目中所有 TLog 模块统一到 `2.0.0`。保留应用自己的 Web/WebFlux、日志实现、RPC 和 HTTP 客户端依赖；这些适配目标不由 TLog 强制引入。

```xml
<dependency>
    <groupId>com.yomahub</groupId>
    <artifactId>tlog-web-spring-boot-starter</artifactId>
    <version>2.0.0</version>
</dependency>
```

无需增加 `-jakarta` 模块。TLog 自身仍为 Java 8 字节码，源码构建需要 JDK 17+；应用运行 JDK 由所选 Spring Boot 和第三方框架决定。旧文档中的普通 Spring 接入不等于 Native Image 支持。

## 删除两种旧接入方式

| 1.x 中的用法 | 2.0 的处理 |
| --- | --- |
| `-javaagent:tlog-agent.jar` | 删除启动参数；`tlog-agent` 模块已移除 |
| `AspectLogEnhance.enhance()` | 删除调用及 import；`enhance.bytes.*` 包已移除 |
| 日志 encoder/layout/converter | 可继续使用对应适配器，核对配置和日志实现版本 |
| MDC `%X{tl}` | 可用于完整标签输出；入口继续写入 MDC |

最小 logback 配置可使用普通 encoder：

```xml
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder><pattern>%d{HH:mm:ss.SSS} %-5level %X{tl} %msg%n</pattern></encoder>
    </appender>
    <root level="INFO"><appender-ref ref="CONSOLE"/></root>
</configuration>
```

采用 MDC 输出时，可设置 `tlog.mdc-enable=true`，防止保留的消息适配器再次追加同一标签。使用 TLog encoder 时，则按其文档输出消息前缀，不要重复打印 `tl`。

## 入口与客户端行为

Boot Servlet 入口由 MVC 拦截器改为 Filter，覆盖 REQUEST、ASYNC、ERROR；同一个 Servlet 请求的异步重派发沿用原 trace/span。默认顺序为 `-2147483647`，在 Boot 字符编码过滤器之后。自定义顺序时仍应让编码过滤器先执行。

非 Boot 用户可继续使用保留的 javax MVC 组件，或按容器命名空间手工注册 Filter。容器外的手工注册要自行设置 dispatcher types 和 asyncSupported。

普通 WebFlux 入口使用 Reactor Context 隔离请求，不改写原始请求头；Gateway、Soul/ShenYu 的转发模式会向下游生成子 span。首次普通 HTTP/WebClient 出站的子 span 为 `0.1`。响应式边界见[WebFlux 文档](/guide/webflux)。

容器中的 RestTemplate、WebClient.Builder、RestClient.Builder 自动添加对应拦截器。不要给已经自动装饰的对象重复添加同一拦截器；容器外创建的客户端仍需手工安装。Boot 4 的客户端 Builder 可能需要对应客户端 starter 或显式 Bean。

## 异步传播

Spring 管理的 `ThreadPoolTaskExecutor` 和 `SimpleAsyncTaskExecutor` 自动装饰，已有 TaskDecorator 会组合保留。应在 Bean 初始化前设置用户 decorator；初始化后再次调用 setter 会替换组合结果。

非 Spring 线程池使用：

```java
ExecutorService pool = TLogExecutors.wrap(Executors.newFixedThreadPool(8));
try {
    pool.submit(() -> businessCall()).get();
} finally {
    pool.shutdown();
}
```

所有执行器重载及单任务 Runnable/Callable 包装都传播 TLog 和 MDC，并在结束后恢复工作线程状态。周期任务捕获提交时上下文；若每轮应有独立 trace，需要在每轮入口建立和清理上下文。未指定包装执行器的 `CompletableFuture.*Async` 默认线程池不会因此自动透传。

`TLogInheritableTask` 保留 API，改用 TTL capture/replay/restore，不再反射访问 JDK 内部字段。它在对象构造时捕获上下文，不能复用同一个实例代表不同请求。

## 配置与扩展点

新增总开关、Web/异步/HTTP 客户端/Scheduled 开关及响应头开关。旧 camelCase 配置可继续通过 Spring relaxed binding 绑定，完整表格见[配置参考](/guide/configuration)。

`spring.application.name` 可选，未设置时使用 `NONE`。纯 Java 应用使用 `TLogRuntime.setAppName("service")`，不需要为了传播器加入 Spring。

自定义 ID 优先采用唯一的 `TLogIdGenerator` Bean，多个候选可用 `@Primary` 指定。旧 `tlog.id-generator` 全类名方式仍保留。

旧子类可继续读取 `extData` 字段：TLog 内部通过 `generate(Map)` 串行保护调用，结束或异常时恢复外层数据并释放当前请求引用。新子类使用 `getExtData()`。外部代码应把 `withExtData(data).generateTraceId()` 改为 `generate(data)`，两个旧方法组成的手工调用链不具备并发原子性。

## 保留的公开 API

`TLogContext`、原有传播头名称和默认标签格式保持不变。旧 `org.slf4j.TLogLogbackTTLMdcAdapter` 保留废弃兼容入口、构造和实例方法；新代码使用 `com.yomahub.tlog.core.enhance.logback` 下的实现。`com.yomahub.tlog.utils.AbstractClock` 与异常类旧 `setMessage` 方法也保留。

业务标签现在只在被拦截方法执行期间生效，返回或抛出业务异常后恢复外层标签；嵌套调用不会持续累加。JDK 代理支持读取实现方法上的注解。原先依赖标签泄漏到后续日志的代码需要调整。

## 上线前验证

用真实请求检查日志前缀、MDC、下游传播头、异常后的线程复用和异步响应渲染。W3C 支持限于入站 traceId 复用，不包含完整出站 traceparent/tracestate 或 span 导出。

当前本地验证范围与未覆盖项见[兼容性与验收](/guide/compatibility)，可运行工程见[示例](/guide/examples)。旧文档的固定性能损耗数字不适用于 2.0，应按自己的负载测量。
