---
title: 可运行示例与一键验收
permalink: /guide/examples
description: '运行真实 HTTP、Dubbo、Gateway、Kafka、RabbitMQ 和纯 Java 示例，查看可重复的验收结果。'
---

# 可运行示例与一键验收

[tlog-example](https://gitee.com/bryan31/tlog-example/tree/TLog-2.0) 的 `TLog-2.0` 分支按场景分目录，每个工程都能单独 `java -jar` 启动，并通过真实的 HTTP、RPC 和 MQ 请求验证链路。旧示例保存在 `legacy/`，不参与默认构建。

```sh
git clone -b TLog-2.0 https://gitee.com/bryan31/tlog-example.git
cd tlog-example
```

想看某个功能怎么接入，直接在下表找对应工程的源码和配置。

## 工程一览

| 目录 | 工程 | 演示的接入方式 |
| --- | --- | --- |
| `tlog-example-web` | `tlog-example-springboot-web` | Boot Servlet 自动配置；RestTemplate、Feign、RestClient、HttpClient 4/5、OkHttp、Hutool、Forest；`@Async`、Callable、`@Scheduled`、各开关 |
| | `tlog-example-webflux` | WebFlux、WebClient、Reactor 线程切换 |
| | `tlog-example-gateway` | Spring Cloud Gateway 转发 |
| | `tlog-example-servlet` | 无 Spring 的原生 Servlet，手工注册 `TLogServletFilter` / `TLogJakartaServletFilter` |
| | `tlog-example-springmvc` | 无 Spring Boot 的 Spring MVC，手工声明 `TLogPropertyInit`、`AspectLogAop` 等 |
| `tlog-example-rpc` | `tlog-example-dubbo-provider` / `-consumer` | Apache Dubbo 直连 |
| | `tlog-example-dubbox-provider` / `-consumer` | Dubbox 2.8.4 直连 |
| `tlog-example-mq` | `tlog-example-mq-kafka` / `-kafka-native` | Spring Kafka 自动装配 / 原生 kafka-clients |
| | `tlog-example-mq-rabbitmq-spring` / `-rabbitmq-native` | Spring AMQP 自动装配 / 原生 amqp-client |
| | `tlog-example-mq-rabbitmq` | 其它 MQ 通用的 `TLogMqWrapBean` 消息体包装 |
| `tlog-example-plain` | `tlog-example-plain-java` | 无 Spring 的 HttpClient 4/5、OkHttp、Hutool、Forest 和 `TLogExecutors` |
| `tlog-example-task` | `-task-jdk` / `-task-spring-scheduled` / `-task-quartz` / `-task-xxljob` | JDK Timer、Spring Scheduled、Quartz、XXL-JOB |
| `tlog-example-log` | logback / log4j / log4j2 的 sync、async、mdc 工程，及 `-logback-ttl-mdc`、`-logstash` | 每种日志框架的每种适配写法 |
| `tlog-example-feature` | `tlog-example-customlabel` / `tlog-example-custom-traceid` | `@TLogAspect` 业务标签；自定义 traceId 生成器与标签模板 |

## 手工运行

用 JDK 17+ 构建，默认是 Boot 2.7。Boot 3.5、4.0 分别加 `-Pboot3`、`-Pboot4`，切换 profile 时要 clean，避免用到上次的产物。运行 JDK 需满足所选 Boot 的要求。

```sh
mvn clean package
```

### HTTP 跨进程调用

```sh
# 终端一：下游
java -jar tlog-example-web/tlog-example-springboot-web/target/tlog-example-springboot-web-2.0.0.jar \
  --server.port=18081 --spring.application.name=demo-http-downstream

# 终端二：调用方
java -jar tlog-example-web/tlog-example-springboot-web/target/tlog-example-springboot-web-2.0.0.jar \
  --server.port=18082 --spring.application.name=demo-http-caller \
  --demo.downstream-url=http://127.0.0.1:18081

# 终端三
curl -H 'tlogTraceId: manual-trace' \
  'http://127.0.0.1:18082/api/chain?client=feign&probe=manual'
```

`client` 可选 `rest-template`、`feign`、`httpclient4`、`httpclient5`、`okhttp`、`hutool`、`forest`，Boot 3/4 还可选 `rest-client`。

响应中的 `entry`、`async`、`downstream`、`after` 等阶段 traceId 都是 `manual-trace`。调用方本地 span 为 `0`，下游为 `0.1`。两个终端的日志里都能看到 `<0><manual-trace>`、`<0.1><manual-trace>` 这样的标签。

### WebFlux、Gateway 与 Dubbo

保持上面 18081 的下游运行：

```sh
# WebFlux（18083）和 Gateway（18084），Gateway 把 /reactive/** 转发给 WebFlux
java -jar tlog-example-web/tlog-example-webflux/target/tlog-example-webflux-2.0.0.jar
java -jar tlog-example-web/tlog-example-gateway/target/tlog-example-gateway-2.0.0.jar
curl -H 'tlogTraceId: gateway-trace' 'http://127.0.0.1:18084/reactive/api/reactive?probe=gateway-manual'

# Dubbo 直连，不需要注册中心；consumer 的 HTTP 入口在 18086
java -jar tlog-example-rpc/tlog-example-dubbo-provider/target/tlog-example-dubbo-provider-2.0.0.jar
java -jar tlog-example-rpc/tlog-example-dubbo-consumer/target/tlog-example-dubbo-consumer-2.0.0.jar
curl -H 'tlogTraceId: rpc-trace' 'http://127.0.0.1:18086/api/rpc?probe=rpc-manual'
```

Gateway 链路的 span 依次为 `0 → 0.1 → 0.1.1`。

### 纯 Java 客户端

保持 18081 的下游运行。程序先确认 classpath 中没有 Spring，再用 HttpClient 4/5、OkHttp、Hutool、Forest 请求下游：

```sh
java -jar tlog-example-plain/tlog-example-plain-java/target/tlog-example-plain-java-2.0.0.jar \
  --downstream-url=http://127.0.0.1:18081 --probe=plain-manual
```

每项检查输出 `CHECK|name=...|passed=true`，有失败时返回非零退出码。

### 日志框架、定时任务与业务标签

```sh
# 日志：/api/log 覆盖请求线程、业务标签、@Async、TLogExecutors、new Thread、未包装线程池
java -jar tlog-example-log/tlog-example-log-log4j-async/target/tlog-example-log-log4j-async-2.0.0.jar
curl -H 'tlogTraceId: log-trace' 'http://127.0.0.1:18106/api/log?probe=log-manual'

# 定时任务：/api/executions 返回每次执行中与执行后的上下文
java -jar tlog-example-task/tlog-example-task-quartz/target/tlog-example-task-quartz-2.0.0.jar
curl 'http://127.0.0.1:18123/api/executions'

# 业务标签
java -jar tlog-example-feature/tlog-example-customlabel/target/tlog-example-customlabel-2.0.0.jar
curl -H 'tlogTraceId: label-trace' 'http://127.0.0.1:18131/api/labels?probe=label-manual'
```

其它日志工程用法相同，端口见各工程的 `application.properties`。XXL-JOB 和 Logstash 需要 Docker 中的服务端，建议直接用下文的一键验收运行。

### Kafka

先启动单节点 Kafka：

```sh
docker run -d --name tlog-kafka -p 127.0.0.1:9092:9092 apache/kafka:3.9.1
```

Spring Kafka 示例中，producer 进程提供 HTTP 入口，发送后等待 consumer 的回复：

```sh
# 终端一
java -jar tlog-example-mq/tlog-example-mq-kafka/target/tlog-example-mq-kafka-2.0.0.jar \
  --demo.role=consumer --spring.application.name=demo-kafka-consumer --server.port=18141

# 终端二
java -jar tlog-example-mq/tlog-example-mq-kafka/target/tlog-example-mq-kafka-2.0.0.jar \
  --demo.role=producer --spring.application.name=demo-kafka-producer --server.port=18142

curl -H 'tlogTraceId: kafka-trace' 'http://127.0.0.1:18142/api/kafka?probe=kafka-manual'
```

响应中 `entry`、`after` 是 producer 的 span `0`，`reply.consumer` 是 `@KafkaListener` 里的 `0.1`，`reply.replyListener` 是 producer 收到回复时的 `0.1.1`，traceId 都是 `kafka-trace`。

原生客户端先启动 consumer，看到 `READY|queue=...` 后再启动 producer：

```sh
java -jar tlog-example-mq/tlog-example-mq-kafka-native/target/tlog-example-mq-kafka-native-2.0.0.jar \
  --role=consumer --bootstrap=127.0.0.1:9092 --topic=tlog.native

java -jar tlog-example-mq/tlog-example-mq-kafka-native/target/tlog-example-mq-kafka-native-2.0.0.jar \
  --role=producer --bootstrap=127.0.0.1:9092 --topic=tlog.native --probe=kafka-native-manual
```

结束后执行 `docker rm -f tlog-kafka`。接入方式见[对 Kafka 的支持](/guide/kafka)。

### RabbitMQ

示例目录自带 Compose 文件，RabbitMQ 映射到本机 `56720` 端口，账号密码均为 `tlogdemo`，仅用于本地演示：

```sh
docker compose up -d --wait rabbitmq
```

Spring AMQP 示例开启了 3 次监听重试：

```sh
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

`@RabbitListener` 的返回值经 replyTo 发回 producer，span 依次是 `0`、`0.1`、`0.1.1`。

原生 amqp-client 和消息体包装两个示例都是先启动 consumer，看到 `READY|queue=...` 后再启动 producer。默认 `/` vhost 在 URI 中要写成 `/%2F`：

```sh
# 原生 amqp-client，header 透传
java -jar tlog-example-mq/tlog-example-mq-rabbitmq-native/target/tlog-example-mq-rabbitmq-native-2.0.0.jar \
  --role=consumer --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' --queue=tlog.native
java -jar tlog-example-mq/tlog-example-mq-rabbitmq-native/target/tlog-example-mq-rabbitmq-native-2.0.0.jar \
  --role=producer --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' --queue=tlog.native --probe=rabbit-native-manual

# TLogMqWrapBean 消息体包装
java -jar tlog-example-mq/tlog-example-mq-rabbitmq/target/tlog-example-mq-rabbitmq-2.0.0.jar \
  --role=consumer --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' --queue=tlog.manual
java -jar tlog-example-mq/tlog-example-mq-rabbitmq/target/tlog-example-mq-rabbitmq-2.0.0.jar \
  --role=producer --amqp-uri='amqp://tlogdemo:tlogdemo@127.0.0.1:56720/%2F' --queue=tlog.manual --probe=mq-manual
```

结束所有 JVM 后执行 `docker compose down -v`。接入方式见[对 RabbitMQ 的支持](/guide/rabbitmq)和[消息体包装](/pages/097174/)。

## 一键验收

验收脚本会构建全部工程，启动独立 JVM 和所需的 Docker 服务（RabbitMQ、Kafka、XXL-JOB 调度中心、Logstash），逐项断言 trace、span、MDC 和实际日志输出。需要 Python 3、Maven、构建 JDK 17+ 和运行中的 Docker：

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

`--tlog-source` 指向 TLog 源码时，脚本先把它安装到本地 Maven 仓库，便于验证任意提交；省略时检查同级 `../TLog`，不存在则使用仓库中的 2.0.0。端口动态分配，容器只映射到本机回环地址，结束后脚本删除自己创建的 JVM、容器、匿名卷和网络。

| 选项 | 用途 |
| --- | --- |
| `--log4j2` | HTTP 示例改用 Log4j2，其它工程保留各自日志配置 |
| `--skip-build` | 重用已构建产物，仍校验版本和日志后端 |
| `--amqp-uri='amqp://user:pass@127.0.0.1:56720/%2F'` | 使用已有 RabbitMQ，脚本不会停止它 |
| `--without-mq` / `--without-kafka` / `--without-docker-extras` | 跳过 RabbitMQ / Kafka / XXL-JOB 与 Logstash，结果只能是 `partial-pass` |

结果写入 `validation-results/<时间-profile-run-id>/`，包括每项断言、各进程日志、jar SHA-256 和关闭检查。Maven clean 不会删除这些记录。

最近一次完整运行（2026-10-25）覆盖 boot2 × JDK 8/17/21/25、boot3 × JDK 17/21/25、boot4 × JDK 17/21/25 共 10 组，每组 78 或 79 项断言全部通过（boot2 没有 RestClient，少一项）。版本细节和未覆盖项见[兼容性与验证范围](/guide/compatibility)。
