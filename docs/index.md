---
home: true
heroImage: /img/logo.svg
heroText: TLog
tagline: 🚀轻量级的分布式日志标记追踪神器
actionText: 开始使用
actionLink: /pages/5b7bd2/
bannerBg: none # auto => 网格纹背景(有bodyBgImg时无背景)，默认 | none => 无 | '大图地址' | background: 自定义背景样式       提示：如发现文本颜色不适应你的背景时可以到palette.styl修改$bannerTextColor变量
features: # 可选的
  - title: 🦋轻量，强大
    details: TLog通过对日志打标签完成企业级微服务的日志追踪。它不收集日志，使用简单， 产生全局唯一追踪码。除了追踪码，TLog还支持SpanId和上下游服务信息 标签的追加。你还可以自定义方法级别的标签，让日志的定位轻而易举。
  - title: ⏰10分钟接入
    details: 为用户使用方便而设计，提供完全零侵入式接入方式，自动探测项目中使用的RPC框架和日志框架， 进行字节码的注入完成系统级日志标签的追加。你的项目用不到10分钟即可接入TLog。
  - title: 🧩适配广泛
    details: TLog适配了市面上主流的RPC框架：dubbo，dubbox，spring cloud。 同时适配了三大主流Log框架：log4j,logback,log4j2。支持多种网关，定时任务框架以及http框架。

# 文章列表显示方式: detailed 默认，显示详细版文章列表（包括作者、分类、标签、摘要、分页等）| simple => 显示简约版文章列表（仅标题和日期）| none 不显示文章列表
postList: none

---

<Notice :data="$frontmatter.notices"/>

## 🌈特别赞助

::: cardList
```yaml
- name: PostCat
  desc: 开源 API 管理工具，接口文档、接口测试、Mock...
  avatar: /img/donate/postcat-logo.png
  link: https://datayi.cn/w/a9By33no
  bgColor: '#102863'
  textColor: '#FFFFFF'
```
:::

<br/><br/>

<p align="center">
  <a class="become-sponsor" href="/pages/fb599d/">成为赞助者</a>
</p>

<style>
.become-sponsor{
  padding: 8px 20px;
  display: inline-block;
  color: #205375;
  border-radius: 30px;
  box-sizing: border-box;
  border: 2px solid #205375;
}
</style>

<br/>

## 🍬特性
* **<font color=#385F71>通过对日志打标签完成轻量级微服务日志追踪</font>**
* **<font color=#385F71>提供三种接入方式：javaagent完全无侵入接入，字节码一行代码接入，基于配置文件的接入</font>**
* **<font color=#385F71>对业务代码无侵入式设计，使用简单，10分钟即可接入</font>**
* **<font color=#385F71>支持常见的log4j，log4j2，logback三大日志框架，并提供自动检测，完成适配</font>**
* **<font color=#385F71>支持dubbo，dubbox，springcloud三大RPC框架</font>**
* **<font color=#385F71>支持Spring Cloud Gateway和Soul网关</font>**
* **<font color=#385F71>适配HttpClient和Okhttp的http调用标签传递</font>**
* **<font color=#385F71>支持三种任务框架，JDK的TimerTask，Quartz，XXL-JOB</font>**
* **<font color=#385F71>支持日志标签的自定义模板的配置，提供多个系统级埋点标签的选择</font>**
* **<font color=#385F71>支持异步线程的追踪，包括线程池，多级异步线程等场景</font>**
* **<font color=#385F71>几乎无性能损耗，快速稳定，经过压测，损耗在0.01%</font>**

<br/><br/>

## ✨最新版本

```xml
<dependency>
    <groupId>com.yomahub</groupId>
    <artifactId>tlog-all-spring-boot-starter</artifactId>
    <version>1.5.1</version>
</dependency>
```

<br/>

## 🎉致谢

TLog在2020年获得“Gitee最有价值开源项目“奖项（GVP）。

感谢OSCHINA和Gitee官方平台对TLog项目的推荐和肯定。

<br/>

## 🏡项目托管

<a href='https://gitee.com/dromara/TLog' target="_blank">
    <img class="no-zoom" src="https://img.shields.io/badge/Gitee-red?logo=gitee&logoColor=white&style=for-the-badge"/>
</a>

<a href="https://github.com/dromara/TLog" target="_blank">
    <img class="no-zoom" src="https://img.shields.io/badge/Github-blue?logo=github&logoColor=white&style=for-the-badge"/>
</a>

<br/><br/>

## 🍭架构图

<img :src="$withBase('/img/arch.svg')" style="zoom: 120%" class="no-zoom">

<br/><br/>

<style>
  .link {
    width: 11em;
    text-align: left;
  }
  .link img {
    height:2.0em;
    max-width:180px;
    margin: 14px;
  }
  .row {
    display: flex;
    flex-direction: row;
  }
</style>

## 🐳Dromara组织成员
<div class="row">
    <span class="link">
        <a href="https://gitee.com/dromara/TLog" target="_blank">
            <img :src="$withBase('/img/dromara/tlog-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/liteFlow" target="_blank">
            <img :src="$withBase('/img/dromara/liteflow-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/hutool" target="_blank">
            <img :src="$withBase('/img/dromara/hutool-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/sa-token" target="_blank">
            <img :src="$withBase('/img/dromara/satoken-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/hmily" target="_blank">
            <img :src="$withBase('/img/dromara/hmily-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/Raincat" target="_blank">
            <img :src="$withBase('/img/dromara/raincat-logo.png')" class="no-zoom" >
        </a>
    </span>
</div>
<div class="row">
    <span class="link">
        <a href="https://gitee.com/dromara/myth" target="_blank">
            <img :src="$withBase('/img/dromara/myth-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/hertzbeat" target="_blank">
            <img :src="$withBase('/img/dromara/hertzbeat-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/forest" target="_blank">
            <img :src="$withBase('/img/dromara/forest-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://jpom.top" target="_blank">
            <img :src="$withBase('/img/dromara/jpom-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/sureness" target="_blank">
            <img :src="$withBase('/img/dromara/sureness-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/easy-es" target="_blank">
            <img :src="$withBase('/img/dromara/ee-logo.png')" class="no-zoom" >
        </a>
    </span>
</div>
<div class="row">
    <span class="link">
        <a href="https://gitee.com/dromara/northstar" target="_blank">
            <img :src="$withBase('/img/dromara/northstar-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/fast-request" target="_blank">
            <img :src="$withBase('/img/dromara/fastrequest-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/dynamic-tp" target="_blank">
            <img :src="$withBase('/img/dromara/dynamictp-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/mendmix" target="_blank">
            <img :src="$withBase('/img/dromara/mendmix-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/cubic" target="_blank">
            <img :src="$withBase('/img/dromara/cubic-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/koalas-rpc" target="_blank">
            <img :src="$withBase('/img/dromara/koalas-logo.png')" class="no-zoom" >
        </a>
    </span>
</div>
<div class="row">
    <span class="link">
        <a href="https://gitee.com/dromara/MaxKey" target="_blank">
            <img :src="$withBase('/img/dromara/maxkey-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/gobrs-async" target="_blank">
            <img :src="$withBase('/img/dromara/gobrsasync-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/x-easypdf" target="_blank">
            <img :src="$withBase('/img/dromara/xeasypdf-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/image-combiner" target="_blank">
            <img :src="$withBase('/img/dromara/imagecombiner-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/dante-cloud" target="_blank">
            <img :src="$withBase('/img/dromara/dantecloud-logo.png')" class="no-zoom" >
        </a>
    </span>
    <span class="link">
        <a href="https://gitee.com/dromara/go-view" target="_blank">
            <img :src="$withBase('/img/dromara/goview-logo.png')" class="no-zoom" >
        </a>
    </span>
</div>

<br/><br/>

<!-- AD -->
<div class="wwads-cn wwads-horizontal page-wwads" data-id="130"></div>
<style>
  .page-wwads{
    width:100%!important;
    min-height: 0;
    margin: 0;
  }
  .page-wwads .wwads-img img{
    width:80px!important;
  }
  .page-wwads .wwads-poweredby{
    width: 40px;
    position: absolute;
    right: 25px;
    bottom: 3px;
  }
  .wwads-content .wwads-text, .page-wwads .wwads-text{
    height: 100%;
    padding-top: 5px;
    display: block;
  }
</style>