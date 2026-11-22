# 鸽了两年的TLog 2.0 来了

> 摘要（公众号摘要栏）：一套 starter 跑通 Spring Boot 2/3/4，新增 Kafka、RabbitMQ 透传，线程池自动传递。

---

上一个版本 1.5.2 还是 2024 年 4 月发的。

这两年群里和 issue 里问得最多的就一句：“TLog 支持 Spring Boot 3 吗？”每次看到都有点心虚。现在 Boot 4 都出来了，这笔债总得还。

## 2.0 更新了什么

- 同一套 starter 支持 Spring Boot 2、3、4
- 新增 Kafka、RabbitMQ 支持，traceId 走消息 header
- Spring 线程池自动传递 traceId，`@Async` 开箱即用
- RestTemplate、WebClient、RestClient 自动装饰
- WebFlux 重写，基于 Reactor Context
- 能复用上游 W3C `traceparent` 里的 trace-id
- 删掉了 javaagent 和字节码注入，只保留日志配置文件接入
- 官网也重新设计了一遍，文档按 2.0 重写：https://tlog.yomahub.com

老项目升级，把 TLog 版本统一改成 `2.0.0`，再删掉 javaagent 参数和 `AspectLogEnhance.enhance()` 调用就行。

## 一套 starter，Boot 2/3/4 通用

坐标不变，版本改成 `2.0.0`：

```xml
<dependency>
    <groupId>com.yomahub</groupId>
    <artifactId>tlog-web-spring-boot-starter</artifactId>
    <version>2.0.0</version>
</dependency>
```

不管是 Boot 2 的老项目，还是 Boot 3、Boot 4 的新项目，引的都是这一个 jar，TLog 自己会判断该怎么注册。

## Kafka 和 RabbitMQ

以前 TLog 对 MQ 的支持，是让你把消息体包一层 `TLogMqWrapBean`。能用，但挺别扭，消息结构变了，别的消费者也得跟着改。

2.0 新增了 `tlog-kafka` 和 `tlog-rabbitmq`，traceId 放在消息 header 里，消息体一个字节不动。

用 Spring Kafka、Spring AMQP 的，引了 starter 就生效：`KafkaTemplate`、`RabbitTemplate` 发出去的消息自动带上 traceId，`@KafkaListener`、`@RabbitListener` 里的日志沿用同一个。你原来配的拦截器、重试这些都会保留。

原生客户端也就一行：Kafka 配个 `interceptor.classes`，RabbitMQ 调一下 `TLogRabbitHeaders.inject`。

## 线程池不用自己包了

异步线程丢 traceId，是 TLog 被问得第二多的问题。

2.0 会自动装饰容器里的 `ThreadPoolTaskExecutor` 和 `SimpleAsyncTaskExecutor`。你自己配了 `TaskDecorator` 也没关系，TLog 是叠加上去，不会替换掉你的。

自己 `new` 的线程池，包一下：

```java
ExecutorService pool = TLogExecutors.wrap(Executors.newFixedThreadPool(8));
```

有个坑提前说：`CompletableFuture.supplyAsync()` 不传线程池的话，用的是 JDK 公共池，TLog 管不到，记得传一个包过的进去。

## HTTP 客户端自动装饰

容器里的 `RestTemplate`、`WebClient.Builder`，还有 Spring 6.1 之后的 `RestClient.Builder`，都会自动加上 TLog 拦截器。

注意是“容器里的”。方法里随手 `new RestTemplate()` 出来的不算。

HttpClient、OkHttp、Hutool、Forest 还是手动装拦截器，不过现在不依赖 Spring 了，纯 Java 程序也能用。

## WebFlux 重写

以前 WebFlux 这块靠 ThreadLocal 硬撑，响应式里线程说切就切，上下文很容易丢。

2.0 改成用 Reactor Context 隔离每个请求，回调里也能正确拿到 traceId。Gateway 转发和普通 WebFlux 入口也分开处理了。

## 认得 W3C traceparent

上游如果接了 OpenTelemetry 之类的，请求头里带着 `traceparent`，TLog 会直接复用里面的 trace-id，两边日志能用同一个 ID 搜到。

这只是入站复用。TLog 还是那个给日志打标签的小工具，不打算变成 APM。

## javaagent 和字节码注入，删了

1.x 有三种接入方式：javaagent、启动时调 `AspectLogEnhance.enhance()`、改日志配置文件。前两种的好处是不用动日志配置。

但这两年字节码这条路越来越难走。JDK 一升级、日志框架一升级，增强点可能就对不上了，出了问题还很难查。

所以 2.0 只留日志配置文件这一种。logback 里加个 `%X{tl}` 就行：

```xml
<pattern>%d{HH:mm:ss.SSS} %-5level %X{tl} %msg%n</pattern>
```

多写一行配置，换来以后升级不用提心吊胆，我觉得值。

## 最后

TLog 从 2020 年 8 月开源到现在，六年多了。它一直就干一件事：让你在一堆日志里，用一个 ID 把一次请求捞出来。

2.0 没打算把它变大，只是让它在新的 Java 和 Spring 上继续好用。

从 1.x 升级的，建议先看一眼官网的升级指南。遇到问题提 issue，或者来群里找我。觉得有用的话，去 Gitee 或 GitHub 点个 star。

---

官网：https://tlog.yomahub.com

升级指南：https://tlog.yomahub.com/guide/upgrade

Gitee：https://gitee.com/dromara/TLog

GitHub：https://github.com/dromara/TLog
