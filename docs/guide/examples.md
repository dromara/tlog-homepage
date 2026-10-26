---
title: 可运行示例与一键验收
permalink: /guide/examples
description: '运行真实 HTTP、Dubbo、Gateway、RabbitMQ 和纯 Java 示例，查看可重复的验收结果。'
---

# 可运行示例与一键验收

`tlog-example` 的 2.0 代码线通过独立 JVM、真实 HTTP/RPC/AMQP 请求和实际日志验证链路。只有断言通过、进程正常关闭才返回成功；旧示例保存在 `legacy/`，不参与默认构建。

以下命令在 `tlog-example` 2.0 源码目录执行，`--tlog-source` 指向匹配的 TLog 源码，便于验证任意提交。

## 一键运行

需要 Python 3、Maven、构建 JDK 17+，完整套件还需可用的本地 Docker。运行 JDK 单独选择：

```sh
# Boot 2.7 / Dubbo 2.7，应用运行在 JDK 8
python3 scripts/verify-demo.py --profile boot2 \
  --build-java-home /path/to/jdk21 \
  --java /path/to/jdk8/bin/java --tlog-source ../TLog

# Boot 3.5 / Dubbo 3.3
python3 scripts/verify-demo.py --profile boot3 \
  --build-java-home /path/to/jdk21 \
  --java /path/to/jdk17/bin/java --tlog-source ../TLog

# Boot 4.0 / Dubbo 3.3
python3 scripts/verify-demo.py --profile boot4 \
  --build-java-home /path/to/jdk21 \
  --java /path/to/jdk25/bin/java --tlog-source ../TLog
```

脚本先安装本地 TLog，再 clean package 示例。端口动态分配，RabbitMQ 默认由脚本创建并只映射到本机回环地址；结束后清理自己创建的 JVM、容器及匿名卷，不操作其它容器。

| 选项 | 用途 |
| --- | --- |
| `--log4j2` | HTTP 模块使用 Log4j2，其它模块保留各自后端 |
| `--skip-build` | 重用产物，但仍校验 jar 内版本、依赖 profile 和日志绑定 |
| `--amqp-uri='amqp://user:pass@127.0.0.1:56720/%2F'` | 使用已有 RabbitMQ，不由脚本停止该 broker |
| `--without-mq` | 跳过真实 RabbitMQ，只能得到 `partial-pass`，不是完整通过 |

结果写入 `validation-results/<时间-profile-run-id>/`，包括每项断言、各进程日志、jar SHA-256 和关闭检查。Maven clean 不会删除这些验证记录。

## 模块与链路

| 模块 | 作用 |
| --- | --- |
| demo-http | Servlet、Feign/RestTemplate/RestClient、Async、Callable、Scheduled、标签/ID、开关 |
| demo-reactive | Reactor 线程切换、WebClient、错误和真实客户端断连取消 |
| demo-gateway | Gateway → WebFlux → HTTP 三进程转发 |
| demo-rpc-api / demo-dubbo-provider / demo-dubbo-consumer | 无注册中心的真实 Dubbo TCP 调用及工作线程清理观察 |
| demo-plain-java | 无 Spring class 的五类 HTTP 客户端、执行器和异步日志 |
| demo-mq | RabbitMQ producer/consumer 独立 JVM、发布确认与关联回执 |

实际完整矩阵是 Boot 2.7/JDK8、Boot 3.5/JDK17、Boot 4.0/JDK25，以及 Boot 3.5/JDK17 的 HTTP Log4j2 后端，共 107 组场景检查。每组另含 17 项纯 Java 与 7 项 RabbitMQ 检查。

## 手工观察 HTTP 链

在 JDK 17+ 下构建；选择现代组合时使用 `mvn clean package -Pboot3` 或 `-Pboot4`，不要混用上次 profile 的旧产物。

```sh
mvn clean package

# 终端一：下游
java -jar demo-http/target/demo-http-2.0.0.jar \
  --server.port=18081 --spring.application.name=demo-http-downstream

# 终端二：调用方
java -jar demo-http/target/demo-http-2.0.0.jar \
  --server.port=18082 --spring.application.name=demo-http-caller \
  --demo.downstream-url=http://127.0.0.1:18081

curl -H 'tlogTraceId: manual-trace' \
  'http://127.0.0.1:18082/api/chain?client=feign&probe=manual'
```

响应中的 entry、async、downstream、after 应沿用同一 trace。调用方本地 span 为 `0`，第一个下游 span 为 `0.1`。日志同时包含日志配置真正渲染的标签和 `DEMO|probe=...|stage=...|trace=...|span=...|mdc=...` 观测字段，验证脚本会分别检查两者。

## 纯 Java 客户端

保持上面的 18081 下游运行：

```sh
java -jar demo-plain-java/target/demo-plain-java-2.0.0.jar \
  --downstream-url=http://127.0.0.1:18081 --probe=plain-manual
```

程序首先断言无法加载 Spring `ApplicationContext`，再使用 HttpClient4、HttpClient5、OkHttp、Hutool 和 Forest 发送真实请求，校验下游 trace、子 span、MDC。还会预热普通/定时线程池，检查多任务、周期任务和异常后的恢复。

正常结果包含 `CHECK|name=...|passed=true`，失败进程返回非零。其内存字节队列只演示 MQ 信封，不冒充 broker；真实 RabbitMQ 在下节。

## 真实 RabbitMQ

```sh
docker compose up -d --wait rabbitmq

# 终端一
java -jar demo-mq/target/demo-mq-2.0.0.jar \
  --role=consumer \
  --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' \
  --queue=tlog.manual

# 等待 READY|queue=tlog.manual，再在终端二执行
java -jar demo-mq/target/demo-mq-2.0.0.jar \
  --role=producer \
  --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' \
  --queue=tlog.manual --probe=mq-manual
```

生产者验证发布确认、关联回执、业务载荷和三次消费：成功、预期异常、再次成功。消费者必须保留本地业务 MDC，并清理 TLog 字段；子 span 应互不相同。

示例账号仅用于本地演示。默认 `/` vhost 在 URI 中是 `/%2F`，不能仅写末尾 `/`。结束两个 JVM 后执行：

```sh
docker compose down -v
```

## Kafka

两个工程的应用代码里都没有 TLog 的 header 读写。`tlog-example-mq-kafka` 使用 Spring Kafka 自动装配，`tlog-example-mq-kafka-native` 是不含 Spring 的 kafka-clients。先启动单节点 Kafka：

```sh
docker run -d --name tlog-kafka -p 127.0.0.1:9092:9092 apache/kafka:3.9.1
```

Spring Kafka：producer 进程提供 HTTP 入口，发送后等待 consumer 的回复。

```sh
# 终端一
java -jar tlog-example-mq/tlog-example-mq-kafka/target/tlog-example-mq-kafka-2.0.0.jar \
  --demo.role=consumer --spring.application.name=demo-kafka-consumer --server.port=18141

# 终端二
java -jar tlog-example-mq/tlog-example-mq-kafka/target/tlog-example-mq-kafka-2.0.0.jar \
  --demo.role=producer --spring.application.name=demo-kafka-producer --server.port=18142

curl -H 'tlogTraceId: kafka-trace' 'http://127.0.0.1:18142/api/kafka?probe=kafka-manual'
```

响应中 `entry`、`after` 是 producer 的 span `0`，`reply.consumer` 是 `@KafkaListener` 里的 `0.1`，`reply.replyListener` 是 consumer 发回的回复被 producer 收到时的 `0.1.1`，三者 traceId 都是 `kafka-trace`。

原生客户端，先启动 consumer，等待 `READY|queue=...` 后再启动 producer：

```sh
java -jar tlog-example-mq/tlog-example-mq-kafka-native/target/tlog-example-mq-kafka-native-2.0.0.jar \
  --role=consumer --bootstrap=127.0.0.1:9092 --topic=tlog.native

java -jar tlog-example-mq/tlog-example-mq-kafka-native/target/tlog-example-mq-kafka-native-2.0.0.jar \
  --role=producer --bootstrap=127.0.0.1:9092 --topic=tlog.native --probe=kafka-native-manual
```

结束后执行 `docker rm -f tlog-kafka`。接入方式见[对 Kafka 的支持](/guide/kafka)。

## RabbitMQ

`tlog-example-mq-rabbitmq-spring` 使用 Spring AMQP 自动装配并开启了 3 次监听重试，`tlog-example-mq-rabbitmq-native` 是不含 Spring 的 amqp-client。使用上节的 Compose RabbitMQ：

```sh
docker compose up -d --wait rabbitmq

# 终端一
java -jar tlog-example-mq/tlog-example-mq-rabbitmq-spring/target/tlog-example-mq-rabbitmq-spring-2.0.0.jar \
  --demo.role=consumer --spring.application.name=demo-rabbit-consumer --server.port=18151 \
  --spring.rabbitmq.port=56720

# 终端二
java -jar tlog-example-mq/tlog-example-mq-rabbitmq-spring/target/tlog-example-mq-rabbitmq-spring-2.0.0.jar \
  --demo.role=producer --spring.application.name=demo-rabbit-producer --server.port=18152 \
  --spring.rabbitmq.port=56720

curl -H 'tlogTraceId: rabbit-trace' 'http://127.0.0.1:18152/api/rabbit?probe=rabbit-manual'
# 前两次消费抛异常、第三次成功：三次调用共用同一个 traceId 和 spanId
curl -H 'tlogTraceId: rabbit-retry' 'http://127.0.0.1:18152/api/rabbit?probe=rabbit-retry&retryCount=2'
```

`@RabbitListener` 的返回值经 replyTo 发回 producer，span 依次是 `0`、`0.1`、`0.1.1`。原生客户端：

```sh
java -jar tlog-example-mq/tlog-example-mq-rabbitmq-native/target/tlog-example-mq-rabbitmq-native-2.0.0.jar \
  --role=consumer --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' --queue=tlog.native

java -jar tlog-example-mq/tlog-example-mq-rabbitmq-native/target/tlog-example-mq-rabbitmq-native-2.0.0.jar \
  --role=producer --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' --queue=tlog.native --probe=rabbit-native-manual
```

接入方式见[对 RabbitMQ 的支持](/guide/rabbitmq)。

一键验收中，两种 MQ 各有 10 项断言：三次往返与 16 个并发往返、监听方法异常后的清理、批量监听逐条建立上下文、两次投递之间消费线程无残留、开关关闭，以及原生客户端的双进程往返。用户自己的拦截器、post processor 和 header 都检查了是否保留。`--without-kafka` 会跳过 Kafka，结果只能是 `partial-pass`。

## 结果应如何理解

真实验收包含 24 并发 HTTP、24 并发 Gateway → WebFlux → HTTP、24 并发 Dubbo，及错误、取消、线程复用后的清理检查。观察器只记录状态，不额外清理 TLog 来掩盖缺陷。

没有把 `legacy/` 中未运行的 Dubbox、XXL-JOB、Quartz 集群、Log4j 1、Logstash 服务端示例算为通过。这是功能与隔离验收，不是长期容量压测。版本和边界汇总见[兼容性说明](/guide/compatibility)。
