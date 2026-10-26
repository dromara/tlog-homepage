---
title: 对 Kafka 的支持
permalink: /guide/kafka
description: 'TLog 2.0 通过 Kafka 消息 header 透传 traceId：Spring Kafka 自动装配，原生 kafka-clients 一行接入。'
---

# 对 Kafka 的支持

TLog 2.0 把追踪上下文写进 Kafka 消息 header，消息体保持原样。Spring Kafka 应用引入 starter 即可，生产端和 `@KafkaListener` 都不需要改代码；原生 kafka-clients 应用配置一个拦截器，消费循环里包一层处理器。

## 引入依赖

`tlog-web-spring-boot-starter` 已包含 `tlog-kafka`，Dubbo、Dubbox、Feign、XXL-JOB 和 all starter 同样包含。Kafka 客户端仍由应用自己声明：

```xml
<dependency>
    <groupId>com.yomahub</groupId>
    <artifactId>tlog-web-spring-boot-starter</artifactId>
    <version>2.0.0</version>
</dependency>
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
```

不用 Spring Boot 的项目直接引入 `com.yomahub:tlog-kafka:2.0.0`。Spring Kafka 需要 2.8 及以上（Spring Boot 2.7 自带的版本），`RecordInterceptor#afterRecord` 从 2.8 开始提供。

## 传递了什么

header 名与 HTTP 透传一致，值为 UTF-8 字节：

| header | 内容 |
| --- | --- |
| `tlogTraceId` | 当前 traceId |
| `tlogSpanId` | 为这条消息分配的子 span，例如 `0.1`、`0.2` |
| `preIvkApp` / `preIvkHost` / `preIp` | 生产者的应用名、主机名和 IP |

同一个上下文里每发一条消息，子 span 序号加一，和发起一次 HTTP 调用的规则相同。发送时没有 TLog 上下文就不写 header，消费端会生成新的 traceId，`preIvkApp` 为 `NONE`。

## Spring Kafka：自动装配

条件满足时，TLog 为容器中的组件加上埋点，已有配置都会保留：

- `DefaultKafkaProducerFactory`：在 `interceptor.classes` 末尾追加 `TLogKafkaProducerInterceptor`。你自己配置的 producer 拦截器仍然在，并排在 TLog 前面。
- 监听容器工厂（`@KafkaListener` 使用的）以及作为 Bean 声明的监听容器：用 `TLogKafkaRecordInterceptor` 包住原有的 `RecordInterceptor`。你的拦截器作为 delegate 继续执行，并且执行时已经能读到 TLog 上下文。

业务代码保持原样：

```java
@Service
public class OrderProducer {
    private final KafkaTemplate<String, String> kafkaTemplate;

    public OrderProducer(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void created(String orderId) {
        log.info("发送订单事件 {}", orderId);
        kafkaTemplate.send("order-created", orderId, orderId);
    }
}

@Component
public class OrderListener {
    @KafkaListener(topics = "order-created", groupId = "inventory")
    public void onCreated(ConsumerRecord<String, String> record) {
        // 这里的日志带着生产者的 traceId，spanId 为 header 中的子 span
        log.info("收到订单事件 {}", record.value());
    }
}
```

上下文在监听容器的消费线程上建立，每条消息处理完（包括抛异常）后清理；每轮 poll 结束时还会再清理一次作为兜底。监听方法里再发出的消息会带上同一个 traceId，层级继续向下延伸，例如 `0.1.1`。

TLog 不注册 `RecordInterceptor` 类型的 Bean：Spring Boot 只在这个类型的 Bean 唯一时才使用它，注册一个会让你自己的拦截器失效。

### 批量监听

批量监听（`List<ConsumerRecord>`）的一批消息可能来自多条链路，TLog 不替你选其中一条。进入监听方法时没有 TLog 上下文，请对每条消息调用 `TLogKafkaConsumerProcessor`：

```java
import com.yomahub.tlog.kafka.TLogKafkaConsumerProcessor;

@KafkaListener(topics = "order-created", groupId = "report", containerFactory = "batchFactory")
public void onBatch(List<ConsumerRecord<String, String>> records) {
    for (ConsumerRecord<String, String> record : records) {
        TLogKafkaConsumerProcessor.process(record, r -> log.info("汇总订单 {}", r.value()));
    }
}
```

`process` 在回调前按 header 建立上下文，回调返回或抛异常后清理。

### 关闭

```yaml
tlog:
  kafka:
    enabled: false
```

`tlog.kafka.enabled=false` 或 `tlog.enabled=false` 时不再写 header，也不再包装监听容器。

## 原生 kafka-clients

不使用 Spring 时，生产端通过 Kafka 自带的拦截器机制接入。`KafkaProducer#send` 在调用线程上执行拦截器，所以能读到业务线程的上下文：

```java
Properties props = new Properties();
props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "127.0.0.1:9092");
props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
// 已有拦截器时用逗号分隔，TLog 放在最后
props.put(ProducerConfig.INTERCEPTOR_CLASSES_CONFIG, TLogKafkaProducerInterceptor.class.getName());
KafkaProducer<String, String> producer = new KafkaProducer<>(props);
```

消费端不能用 `ConsumerInterceptor`：它拿到的是整批消息，执行时机也不在业务处理时。自己写 poll 循环的应用，对每条消息调用处理器：

```java
while (running) {
    for (ConsumerRecord<String, String> record : consumer.poll(Duration.ofMillis(500))) {
        TLogKafkaConsumerProcessor.process(record, r -> handle(r));
    }
}
```

需要手工读写 header 时，可以使用 `TLogKafkaHeaders.inject(headers)` 和 `TLogKafkaHeaders.read(headers, name)`。

## 使用边界

- 只装饰容器中的 `DefaultKafkaProducerFactory` 和监听容器。自己 `new` 出来的工厂或容器，按原生方式配置 `interceptor.classes`，或调用 `setRecordInterceptor(new TLogKafkaRecordInterceptor<>(原有拦截器))`。
- 已经发送过的 `ProducerRecord` 再次发送时，header 是只读的，TLog 保留原有 header，不会报错。
- 监听方法把工作交给其它线程池时，该线程池需要经过 TLog 装饰：Spring 管理的执行器自动装饰，外部线程池使用 `TLogExecutors.wrap`，见[线程池](/pages/a69e1d/)。
- 已实际运行验证：Spring Kafka 2.8.11 / 3.3.16 / 4.0.6（对应 Boot 2.7 / 3.5 / 4.0）与 Kafka 3.9.1 broker。Kafka 事务、`@RetryableTopic`、Kafka Streams 尚未覆盖。

可运行的双进程示例见[可运行示例](/guide/examples#kafka)。其它消息中间件仍可使用[消息体包装](/pages/097174/)。
