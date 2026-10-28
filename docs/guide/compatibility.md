---
title: 兼容性与验证范围
permalink: /guide/compatibility
description: 'TLog 2.0 的 JDK 与 Spring Boot 兼容矩阵、源码构建方式及实际验收范围。'
---

# 兼容性与验证范围

本页对应 TLog 2.0，说明支持的运行环境、依赖边界和已经执行的验收范围。

## 从源码构建

正常接入直接从 Maven 仓库引入 `2.0.0`。如需验证未发布的提交，可在 TLog 源码目录使用 JDK 17 或更高版本执行：

```sh
mvn clean install
```

构建 JDK 与应用运行 JDK 是两件事：TLog 自身按 `--release 8` 编译，应用仍须满足所选 Spring Boot、日志实现、RPC 框架和 HTTP 客户端的 JDK 要求。升级时统一 TLog 模块版本，不混用 1.x 和 2.x。

## 同一套 starter 覆盖三代 Boot

| 应用环境 | Servlet 命名空间 | 运行基线 | TLog 接入 |
| --- | --- | --- | --- |
| Spring Boot 2 / Spring 5 | javax | JDK 8+，依具体 Boot 版本 | 原有 starter 坐标 |
| Spring Boot 3 / Spring 6 | jakarta | JDK 17+ | 同一套 starter |
| Spring Boot 4 / Spring 7 | jakarta | JDK 17+ | 同一套 starter |

无需增加 `-jakarta` 模块或复制整套配置。TLog 根据 Spring 代际注册匹配的 Servlet Filter，并为 Boot 2 与 Boot 3/4 提供对应的自动配置发现文件。Spring 7 的 HTTP 头 API 变化已在集成代码中处理。

兼容性表示库的适配范围，不表示所有第三方依赖的任意历史版本都能运行。例如，Forest 1.5.14 的动态代理在 JDK 17+ 上不可用，示例工程使用的是 Forest 1.8.0。

## 依赖由应用选择

TLog 对 Spring、Servlet、日志实现、OkHttp、Forest、Apache HttpClient 等适配目标采用 provided/optional。应用继续声明自己的框架和客户端版本，TLog 不替应用组装所有运行依赖。

| 场景 | 自动接入范围 |
| --- | --- |
| Servlet / 普通 WebFlux / 对应网关 | starter 条件满足时注册入口 |
| Spring HTTP 客户端 | 容器中的 RestTemplate、WebClient.Builder、RestClient.Builder |
| RestClient | Spring 6.1+；需应用提供 Builder 或对应客户端 starter |
| Spring 异步执行器 | ThreadPoolTaskExecutor、SimpleAsyncTaskExecutor Bean，组合已有 TaskDecorator |
| 非 Spring 管理线程池 | 显式使用 TLogExecutors.wrap |
| HttpClient / OkHttp / Hutool / Forest | 手工安装对应请求拦截器 |
| Apache Dubbo / Dubbox | 对应模块的 SPI Filter |
| Spring Kafka（2.8+） | 容器中的 DefaultKafkaProducerFactory、@KafkaListener 监听容器，经消息 header 透传 |
| Spring AMQP（2.4+） | 容器中的 RabbitTemplate、@RabbitListener 监听容器及其回复，经消息 header 透传 |
| 原生 kafka-clients / amqp-client | 配置 TLogKafkaProducerInterceptor、调用 TLogRabbitHeaders.inject；消费端使用对应处理器 |
| 其它 MQ | 显式序列化 TLogMqWrapBean，并在消费工作线程内处理 |

Boot 4 的客户端自动配置有所拆分。服务端 Web starter 存在，不等于所有客户端 Builder 都已声明。初始化后再次替换 TaskDecorator，也会替换 TLog 已安装的组合装饰器。

## 纯 Java 主动发起链路

HttpClient、OkHttp、Hutool、Forest 的适配器不要求 Spring。后台程序可用 Spring 无关的运行配置建立入口；调用客户端时仍要安装该客户端的 TLog 拦截器：

```java
import com.yomahub.tlog.context.TLogRuntime;
import com.yomahub.tlog.context.TLogContext;
import com.yomahub.tlog.core.rpc.TLogRPCHandler;

TLogRuntime.setAppName("batch-client");
TLogRPCHandler handler = new TLogRPCHandler();
try {
    // 没有上游头，生成这次任务的 traceId。
    handler.processProviderSide(headerName -> null);
    System.out.println(TLogContext.getTraceId());
    // 在这里调用已经安装 TLog 拦截器的客户端。
} finally {
    handler.cleanThreadLocal();
}
```

日志实现和客户端依赖仍需由应用提供。不要在这种环境调用 Spring 专属的配置类；真正无 Spring 的打包和网络验证见[纯 Java 示例](/guide/examples#纯-java-客户端)。

## 实际执行过的验证

TLog 库 **158 项测试通过**（在源码目录执行 `mvn test -DskipTests=false`，项目默认跳过测试）。2026-10-22 完成的库级 fat jar 验证覆盖 Servlet 与 WebFlux：

| Spring Boot | 运行 JDK | 已执行的入口验证 |
| --- | --- | --- |
| 2.0.5.RELEASE | 8 | Servlet、WebFlux |
| 2.7.18 | 8、17 | Servlet、WebFlux |
| 3.2.12 | 17 | Servlet、WebFlux |
| 3.5.16 | 21 | Servlet、WebFlux |
| 4.0.7 | 25 | Servlet、WebFlux |

2026-10-25，[示例工程](/guide/examples)的一键验收在 10 组 Boot/JDK 组合上完整通过：

| profile | Spring Boot | 运行 JDK | 断言 |
| --- | --- | --- | --- |
| boot2 | 2.7.18 | 8、17、21、25 | 78/78 |
| boot3 | 3.5.16 | 17、21、25 | 79/79 |
| boot4 | 4.0.7 | 17、21、25 | 79/79 |

boot2 少的一项是 RestClient，它从 Spring 6.1 才提供。每组都启动真实进程和服务端，覆盖 Servlet、WebFlux、Gateway、Feign、RestTemplate、HttpClient 4/5、OkHttp、Hutool、Forest、Apache Dubbo、Dubbox、Kafka、RabbitMQ、JDK Timer、Spring Scheduled、Quartz、XXL-JOB 调度中心、logback / log4j / log4j2 全部适配写法和 Logstash。库测试数与示例断言数是不同统计口径，不相加。

各 profile 使用的 MQ 版本：

| profile | spring-kafka / kafka-clients | spring-amqp / amqp-client |
| --- | --- | --- |
| boot2 | 2.8.11 / 3.1.2 | 2.4.17 / 5.14.3 |
| boot3 | 3.3.16 / 3.9.2 | 3.2.12 / 5.25.0 |
| boot4 | 4.0.6 / 4.1.2 | 4.0.4 / 5.27.1 |

broker 为 `apache/kafka:3.9.1`（KRaft 单节点）和 `rabbitmq:4.1-alpine`，原生 RabbitMQ 示例的 amqp-client 固定为 5.20.0。

## 哪些验证没有被宣称完成

- Soul、ShenYu 网关没有真实服务端示例。
- Quartz 只验证单节点内存调度，没有覆盖集群模式。
- Kafka 事务、`@RetryableTopic`、Kafka Streams 未覆盖；RabbitMQ 的 `DirectMessageListenerContainer` 只有单元测试，RabbitMQ Stream、`AsyncRabbitTemplate` 未覆盖。
- 24 并发链路检查验证隔离与清理，不等于长时间性能、稳定性或容量压测。
- 单套 Java 8 产物不等于 GraalVM Native Image 验证，也不等于所有第三方版本组合均逐一测试。

## W3C 与其它边界

默认开启 `tlog.w3c-trace-context=true`。入站有 TLog traceId 时优先使用它；没有时，才尝试从合法 `traceparent` 复用 trace-id。非法值被忽略并生成新 ID。

```sh
curl -H 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' \
  'http://127.0.0.1:18081/api/context?probe=w3c-manual'
```

TLog 仍使用自己的层级 spanId 和出站头。本版本不宣称完整 W3C 出站 traceparent/tracestate、采样决策、OpenTelemetry span 导出或 APM 界面。

2.0 已移除 javaagent 和 `AspectLogEnhance.enhance()`，日志通过配置文件适配器或 MDC 输出。原生线程、未包装的外部执行器、脱离 Reactor 链路的手工订阅仍需明确管理上下文；详见[WebFlux](/guide/webflux)与[示例](/guide/examples)。

追踪会增加上下文捕获与恢复开销。2.0 不继续承诺固定“0.01% 损耗”；应结合自己的日志量、线程模型和请求负载做测量。
