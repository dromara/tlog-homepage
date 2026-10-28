---
title: 快速开始
permalink: /guide/quick-start
description: '在已有 Spring Boot 应用中接入 TLog 2.0，配置日志并用真实 HTTP 请求验证。'
---

# 快速开始

本页以已有的 Spring Boot Web 应用和 logback 为例，完成依赖、日志输出和一次真实请求验证。

## 1. 添加依赖

保留应用原有的 Boot parent/BOM、Web starter 和日志实现，再加入：

```xml
<dependency>
    <groupId>com.yomahub</groupId>
    <artifactId>tlog-web-spring-boot-starter</artifactId>
    <version>2.0.0</version>
</dependency>
```

Boot 2、3、4 使用同一套 TLog 坐标，不需要 `-jakarta` 后缀。TLog 自身为 Java 8 字节码，运行 JDK 仍要满足应用框架要求。Boot 4 的 Servlet 应用可以使用 `spring-boot-starter-webmvc`；TLog 的 starter 不替应用引入整套 Web 运行时。

Feign、Dubbo、Gateway 等场景按[依赖表](/pages/9bca79/)补充对应模块。普通 WebFlux 也可以使用 Web starter 中的适配，传播方式见[WebFlux](/guide/webflux)。

## 2. 配置日志

在 `src/main/resources/logback-spring.xml` 中输出完整 MDC 标签：

```xml
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %-5level [%thread] %X{tl} %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>
    <root level="INFO"><appender-ref ref="CONSOLE"/></root>
</configuration>
```

在 `application.yml` 中设置应用名和 MDC 输出模式：

```yaml
spring:
  application:
    name: order-service

tlog:
  mdc-enable: true
```

每个请求进入时，TLog 会把完整标签写入 MDC 的 `tl` 字段，pattern 中的 `%X{tl}` 负责把它打印出来。这里用的是 logback 自带的普通 encoder，不需要 Javaagent、启动类增强调用或额外的 MDC listener。

`mdc-enable: true` 表示“标签由 MDC 输出”。如果项目里还保留着 TLog 的 encoder/layout/converter，它们看到这个开关就不再往消息前面拼接标签，日志里不会出现两份。两种输出方式的区别见[日志适配](/pages/5223de/)。

## 3. 验证入口

在应用中加入一个普通 Controller：

```java
import com.yomahub.tlog.context.TLogContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TraceDemoController {
    private static final Logger log = LoggerFactory.getLogger(TraceDemoController.class);

    @GetMapping("/trace-demo")
    public String trace() {
        log.info("处理请求");
        return TLogContext.getTraceId();
    }
}
```

按应用原有方式启动，发送请求：

```sh
curl -i -H 'tlogTraceId: demo-request-001' http://localhost:8080/trace-demo
```

应当看到响应正文 `demo-request-001`、同值的 `tlogTraceId` 响应头，控制台日志类似：

```text
10:15:30.123 INFO  [http-nio-8080-exec-1] <0><demo-request-001> c.e.demo.TraceDemoController - 处理请求
```

`<0><demo-request-001>` 就是 TLog 标签，默认格式为 `<spanId><traceId>`。`0` 表示这是链路的入口节点。

再发送一次不带该头的请求，TLog 会生成新的 traceId。没有请求或任务入口时，普通启动日志不一定有标签，这是正常情况。

## 4. 向下游调用

容器中的 `RestTemplate` Bean 会自动添加 TLog 拦截器：

```java
@Bean
public RestTemplate restTemplate() {
    return new RestTemplate();
}
```

从该 Bean 发起调用后，已经接入 TLog 的下游应看到相同 traceId 和子 span，例如 `0.1`。不要在方法中临时 `new RestTemplate()` 并期待 Bean 自动装饰。

用 `KafkaTemplate` 或 `RabbitTemplate` 发送消息也一样：starter 会把 traceId 写进消息 header，`@KafkaListener`、`@RabbitListener` 里的日志沿用同一个 traceId。详见 [Kafka](/guide/kafka) 和 [RabbitMQ](/guide/rabbitmq)。

`WebClient.Builder` 和 Spring 6.1+ 的 `RestClient.Builder` 也支持自动装饰；Builder 需要由应用或对应 Boot 客户端自动配置提供。Boot 4 拆分了部分客户端 starter，不能只凭服务端 starter 推断 Builder 一定存在。

## 5. 加入异步与自定义 ID

`tlog.async.enabled` 默认开启，对 Spring 管理的 `ThreadPoolTaskExecutor` / `SimpleAsyncTaskExecutor` 自动组合 TaskDecorator。`@Async` 仍需按 Spring 的方式启用并通过代理调用。自行创建的线程池使用 `TLogExecutors.wrap`，详细示例见[线程池](/pages/a69e1d/)。

需要自己的 traceId 格式时，可声明一个 `TLogIdGenerator` Bean；配置示例、优先级和功能开关见[配置参考](/guide/configuration)。

完整跨进程验证见[可运行示例](/guide/examples)。从 1.x 迁移时先读[升级指南](/guide/upgrade)，其中包含明确移除项和异步边界。
