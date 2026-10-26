---
title: 对 RabbitMQ 的支持
permalink: /guide/rabbitmq
description: 'TLog 2.0 通过 RabbitMQ 消息 header 透传 traceId：Spring AMQP 自动装配，原生 amqp-client 一行接入。'
---

# 对 RabbitMQ 的支持

TLog 2.0 把追踪上下文写进 AMQP 消息 header，消息体保持原样。Spring AMQP 应用引入 starter 即可，`RabbitTemplate` 和 `@RabbitListener` 都不需要改代码；原生 amqp-client 应用在发送和消费处各加一行。

## 引入依赖

`tlog-web-spring-boot-starter` 已包含 `tlog-rabbitmq`，Dubbo、Dubbox、Feign、XXL-JOB 和 all starter 同样包含。RabbitMQ 客户端仍由应用自己声明：

```xml
<dependency>
    <groupId>com.yomahub</groupId>
    <artifactId>tlog-web-spring-boot-starter</artifactId>
    <version>2.0.0</version>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

不用 Spring Boot 的项目直接引入 `com.yomahub:tlog-rabbitmq:2.0.0`。Spring AMQP 以 2.4（Spring Boot 2.7 自带的版本）为基线。

## 传递了什么

header 名与 HTTP 透传一致：

| header | 内容 |
| --- | --- |
| `tlogTraceId` | 当前 traceId |
| `tlogSpanId` | 为这条消息分配的子 span，例如 `0.1`、`0.2` |
| `preIvkApp` / `preIvkHost` / `preIp` | 生产者的应用名、主机名和 IP |

同一个上下文里每发一条消息，子 span 序号加一。发送时没有 TLog 上下文就不写 header，消费端会生成新的 traceId，`preIvkApp` 为 `NONE`。

## Spring AMQP：自动装配

条件满足时，TLog 为容器中的组件加上埋点，你已有的 post processor 和 advice 都会保留：

- `RabbitTemplate`：在 beforePublishPostProcessors 末尾追加 `TLogRabbitPublishPostProcessor`。它在调用 `convertAndSend` 的线程上执行，所以能读到业务线程的上下文。
- 监听容器工厂（`@RabbitListener` 使用的）：把 `TLogRabbitListenerAdvice` 放在 adviceChain 最外层，并为监听方法返回值的回复追加 header。
- 作为 Bean 声明的监听容器：同样处理 adviceChain。

业务代码保持原样：

```java
@Service
public class OrderProducer {
    private final RabbitTemplate rabbitTemplate;

    public OrderProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void created(String orderId) {
        log.info("发送订单事件 {}", orderId);
        rabbitTemplate.convertAndSend("order.exchange", "order.created", orderId);
    }
}

@Component
public class OrderListener {
    @RabbitListener(queues = "order.created")
    public String onCreated(String orderId) {
        // 这里的日志带着生产者的 traceId，spanId 为 header 中的子 span
        log.info("收到订单事件 {}", orderId);
        return "ok"; // 经 replyTo 发回的回复同样带着当前 traceId
    }
}
```

上下文在监听容器的消费线程上建立，监听方法返回或抛异常后清理。监听方法里再发出的消息，以及返回值经 replyTo 发回的回复，都带着同一个 traceId，层级继续向下延伸，例如 `0.1.1`。

### 重试

TLog 的 advice 在最外层，Spring Boot 开启监听重试（`spring.rabbitmq.listener.simple.retry.enabled=true`）时，重试 advice 在它内层。同一条消息的几次重试共用一个 traceId 和 spanId，日志里可以直接看出是同一条消息在重试。

### 批量监听

批量监听（`List<Message>`）的一批消息可能来自多条链路，TLog 不替你选其中一条。进入监听方法时没有 TLog 上下文，请对每条消息调用 `TLogRabbitMessageProcessor`：

```java
import com.yomahub.tlog.rabbitmq.spring.TLogRabbitMessageProcessor;

@RabbitListener(queues = "order.created", containerFactory = "batchFactory")
public void onBatch(List<Message> messages) {
    for (Message message : messages) {
        TLogRabbitMessageProcessor.process(message, m -> log.info("汇总订单 {}", new String(m.getBody())));
    }
}
```

自己调用 `RabbitTemplate#receive` 拉取消息时，用法相同。

### 关闭

```yaml
tlog:
  rabbitmq:
    enabled: false
```

`tlog.rabbitmq.enabled=false` 或 `tlog.enabled=false` 时不再写 header，也不再修改监听容器的 adviceChain。

## 原生 amqp-client

发送前用 `TLogRabbitHeaders.inject` 得到带 TLog header 的新 `BasicProperties`。原对象不会被修改，`correlationId`、`replyTo` 和你自己的 header 都会保留；当前没有上下文时原样返回：

```java
import com.yomahub.tlog.rabbitmq.TLogRabbitHeaders;

AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
        .contentType("application/json")
        .build();
channel.basicPublish("", queue, TLogRabbitHeaders.inject(props), body);
```

消费端用 `TLogRabbitConsumerProcessor.wrap` 包住 `DeliverCallback`，回调在 TLog 上下文内执行，返回或抛异常后清理：

```java
import com.yomahub.tlog.rabbitmq.TLogRabbitConsumerProcessor;

channel.basicConsume(queue, false, TLogRabbitConsumerProcessor.wrap((tag, delivery) -> {
    log.info("收到消息 {}", new String(delivery.getBody(), StandardCharsets.UTF_8));
    channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
}), tag -> { });
```

自己拿到 `Delivery` 时，也可以调用 `TLogRabbitConsumerProcessor.process(delivery, d -> ...)`。原生客户端收到的字符串 header 是 `LongString`，`TLogRabbitHeaders.read` 能直接读取。

## 使用边界

- 只装饰容器中的 `RabbitTemplate`、监听容器工厂和监听容器。自己 `new` 出来的对象，手工调用 `addBeforePublishPostProcessors(new TLogRabbitPublishPostProcessor())`，或把 `TLogRabbitListenerAdvice` 放进 adviceChain 最外层。
- 消息确认、死信和幂等仍由你的消费者实现，TLog 只负责上下文。
- 监听方法把工作交给其它线程池时，该线程池需要经过 TLog 装饰，见[线程池](/pages/a69e1d/)。
- 已实际运行验证：Spring AMQP 2.4.17 / 3.2.12 / 4.0.4（对应 Boot 2.7 / 3.5 / 4.0）、原生 amqp-client 5.20.0，broker 为 RabbitMQ 4.1。`DirectMessageListenerContainer` 只有单元测试，RabbitMQ Stream、`AsyncRabbitTemplate` 尚未覆盖。

可运行的双进程示例见[可运行示例](/guide/examples#rabbitmq)。其它消息中间件仍可使用[消息体包装](/pages/097174/)。
