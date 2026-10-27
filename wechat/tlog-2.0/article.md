# TLog 2.0 发布：鸽了两年，这次把 Boot 2、3、4 一起接住了

> 标题备选：
> 1. TLog 2.0 发布：鸽了两年，这次把 Boot 2、3、4 一起接住了
> 2. 一个 starter 跑通 Spring Boot 2/3/4，TLog 2.0 来了
> 3. TLog 2.0：删掉了 javaagent，补上了 Kafka 和 RabbitMQ
>
> 摘要（公众号摘要栏，54 字以内）：同一套坐标适配 Boot 2/3/4，新增 Kafka、RabbitMQ 透传，线程池自动传递。顺便聊聊为什么删掉 javaagent。

---

上一个正式版本 1.5.2 是 2024 年 4 月发的。

之后这两年，群里和 issue 里问得最多的一句话就是：“TLog 支持 Spring Boot 3 吗？”

说实话，每次看到都有点心虚。Boot 3 换成了 jakarta 命名空间，TLog 的 Servlet 那一层直接就挂了。很多人是自己 fork 一份改包名凑合用的，还有人干脆换掉了。

现在 Boot 4 都出来了，这笔债总得还。所以有了 TLog 2.0。

## 先说结论

如果你只想知道升级要改什么，看这一段就够了：

- 所有 TLog 依赖版本改成 `2.0.0`，坐标不用动，**不需要加什么 `-jakarta` 后缀**
- 启动参数里如果有 `-javaagent:tlog-agent.jar`，删掉
- 代码里如果有 `AspectLogEnhance.enhance()`，删掉
- 日志配置文件里用 `%X{tl}` 或者原来的 TLog encoder/layout，二选一

就这些。Boot 2.x 的老项目、Boot 3 的新项目、已经在尝鲜 Boot 4 的项目，用的是同一个 jar。

## 为什么没有做 `-jakarta` 版本

这个其实是我纠结最久的地方。

最省事的做法是复制一套模块，包名全替换成 jakarta，发一组 `tlog-xxx-jakarta`。很多开源项目都是这么干的，我中间也真写过这么一版，代码都提交了。

后来自己又给撤了。

原因很简单：用户要自己判断该引哪个，引错了启动不报错、日志里就是没有 traceId，查半天。而且模块数量直接翻倍，以后每修一个 bug 要改两遍，我自己都不想维护。

所以 2.0 换了个思路：TLog 自己按 Java 8 字节码编译，运行时看你用的是哪代 Spring，自动注册 javax 或 jakarta 的 Filter。Boot 2 走 `spring.factories`，Boot 3/4 走 `AutoConfiguration.imports`，两份发现文件都带着。Spring 7 里 HTTP Header 的一些 API 变化也在代码里处理掉了。

对用户来说就是：引同一个 starter，剩下的别管。

## javaagent 和字节码注入，删了

这一条可能会让部分老用户不太习惯。

TLog 1.x 一直提供三种接入方式：javaagent、启动类里调 `AspectLogEnhance.enhance()` 做字节码注入、改日志配置文件。前两种的卖点是“不用改日志配置”。

但这两年下来，字节码这条路的问题越来越多。新版本 JDK 对内部类的访问越管越严，日志框架升级一次，增强点可能就对不上了。出了问题用户很难排查，因为你根本看不到它改了什么。

日志配置文件这条路虽然要多写一行，但它是透明的，所见即所得。

所以 2.0 只保留了日志配置文件这一种接入。最小的 logback 配置就长这样：

```xml
<pattern>%d{HH:mm:ss.SSS} %-5level %X{tl} %msg%n</pattern>
```

多写一个 `%X{tl}`，换来的是以后升级 JDK 不用提心吊胆。我觉得值。

## 这次补上的几块

### 1. Kafka 和 RabbitMQ 终于是“真”支持了

以前 TLog 对 MQ 的支持是让你把消息体包一层 `TLogMqWrapBean`。能用，但说实话挺别扭的，消息体结构都变了，别的消费者也得跟着改。

2.0 新增了 `tlog-kafka` 和 `tlog-rabbitmq` 两个模块，traceId 走消息 header 透传，消息体一个字节不动。

用 Spring Kafka、Spring AMQP 的话，引了 starter 基本就生效了：`KafkaTemplate`、`RabbitTemplate` 发出去的消息自动带上 header，`@KafkaListener`、`@RabbitListener` 里打的日志沿用同一个 traceId。你自己配的拦截器、post processor、重试 advice 都会保留，不会被覆盖。

不用 Spring 的原生客户端，也就是一行的事：Kafka 配一个 `interceptor.classes`，RabbitMQ 调一下 `TLogRabbitHeaders.inject`。

不想要的话，`tlog.kafka.enabled`、`tlog.rabbitmq.enabled` 可以单独关掉。

### 2. 线程池不用自己包了

异步线程丢 traceId，这个是 TLog 被问到第二多的问题。

2.0 会自动装饰容器里的 `ThreadPoolTaskExecutor` 和 `SimpleAsyncTaskExecutor`。如果你已经配了自己的 `TaskDecorator`，TLog 是组合进去，不是替换掉。`@Async` 方法里的日志现在开箱就有 traceId。

自己 `new` 出来的线程池，包一下就行：

```java
ExecutorService pool = TLogExecutors.wrap(Executors.newFixedThreadPool(8));
```

这里有个坑提前说一下：`CompletableFuture.supplyAsync()` 不指定线程池的时候用的是 JDK 的公共池，那个 TLog 管不到，记得传一个包装过的线程池进去。

### 3. HTTP 客户端自动装饰

容器里的 `RestTemplate`、`WebClient.Builder`，还有 Spring 6.1 之后的 `RestClient.Builder`，都会自动加上 TLog 拦截器。

注意是“容器里的”。如果你在方法里随手 `new RestTemplate()`，那它是不会被自动装饰的，这个得自己加。

HttpClient 4/5、OkHttp、Hutool、Forest 这些依旧是手动装拦截器，不过现在它们不再依赖 Spring，纯 Java 的批处理程序也能用。

### 4. WebFlux 重写了一遍

以前 WebFlux 这块是靠 ThreadLocal 硬撑的，说实话比较糙。响应式里线程说切就切，上下文很容易丢，或者跟别的请求混在一起。

2.0 改成用 Reactor Context 隔离每个请求，再通过命名 hook 在回调里恢复日志上下文。普通的 WebFlux 入口和网关转发也拆开处理了，Gateway 往下游转发会正确生成子 span。一个顺手修掉的小问题：之前第一个 WebClient 出站的 spanId 不对，现在是 `0.1`。

### 5. 能认 W3C 的 traceparent 了

如果你的上游已经接了 OpenTelemetry 之类的东西，请求头里带着 `traceparent`，TLog 2.0 会直接复用里面的 trace-id，这样两边的日志能用同一个 ID 搜到。

先把话说清楚：这个只是**入站复用**。TLog 不会往外发 traceparent，也不做采样、不导出 span。TLog 一直以来的定位就是给日志打标签，不是 APM，这次也没打算变。

## 测了什么，没测什么

这次我在测试上花的时间，可能比写代码还多。

TLog 库本身现在有 158 项测试。另外单独做了一个示例工程，按 Web、RPC、MQ、任务调度、日志框架这些类别拆成了几十个可以单独启动的小工程，每个都是真起 JVM、真发请求、真去读日志文件做断言，不是 mock。

跑过的组合大概是这样：

| Spring Boot | JDK |
| --- | --- |
| 2.0.5 | 8 |
| 2.7.18 | 8、17 |
| 3.2.12 | 17 |
| 3.5.16 | 21 |
| 4.0.7 | 25 |

Kafka 和 RabbitMQ 是用 Docker 起的真 broker 跑的，Boot 2.7、3.5、4.0 三组都过了。

但也得老实说没测到的：

- Dubbox、Soul/ShenYu 这些比较老的模块，代码还在，但这轮没有完整起服务端验证
- Kafka 事务、`@RetryableTopic`、Kafka Streams 没覆盖
- 没做长时间的压测

还有一件事。以前文档里写过“性能损耗 0.01%”，这次我把这句话删了。那个数字是很早以前在特定场景下测的，现在代码变化这么大，再拿来用不太负责。追踪肯定是有开销的，多少取决于你的日志量和线程模型，建议自己压一下。

## 最后

TLog 从 2020 年 8 月开源到现在，六年多了。

它一直是个很小的东西，就干一件事：让你在一堆日志里，能用一个 ID 把一次请求捞出来。不用部署服务端，不用改业务代码，十分钟接完。

2.0 也没想把它变大，只是让它在新的 Java 和 Spring 版本上继续能用、用得放心一点。

从 1.x 升级的同学，建议先看一下官网的升级指南，异步那一节尤其值得读。遇到问题直接提 issue，或者到群里找我。

如果觉得 TLog 帮到了你，去 Gitee 或者 GitHub 点个 star，这对我挺重要的。

---

官网：https://tlog.yomahub.com

升级指南：https://tlog.yomahub.com/guide/upgrade

Gitee：https://gitee.com/dromara/TLog

GitHub：https://github.com/dromara/TLog

示例工程：https://gitee.com/bryan31/tlog-example
