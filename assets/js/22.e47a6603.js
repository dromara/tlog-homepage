(window.webpackJsonp=window.webpackJsonp||[]).push([[22],{481:function(t,e,p){"use strict";p.r(e);var a=p(8),s=Object(a.a)({},(function(){var t=this,e=t._self._c;return e("ContentSlotsDistributor",{attrs:{"slot-key":t.$parent.slotKey}},[e("p",[t._v("TLog默认只打出spanId和traceId，以"),e("code",[t._v("<$spanId><$traceId>")]),t._v("这种模板打出，当然你能自定义其模板。还能加入其它的标签头")]),t._v(" "),e("p",[t._v("你只需要在springboot的application.properties里如下定义：")]),t._v(" "),e("div",{staticClass:"language-properties extra-class"},[e("pre",{pre:!0,attrs:{class:"language-properties"}},[e("code",[e("span",{pre:!0,attrs:{class:"token key attr-name"}},[t._v("tlog.pattern")]),e("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("=")]),e("span",{pre:!0,attrs:{class:"token value attr-value"}},[t._v("[$preApp][$preIp][$spanId][$traceId]")]),t._v("\n")])])]),e("p",[e("code",[t._v("$preApp")]),t._v("：上游微服务节点名称")]),t._v(" "),e("p",[e("code",[t._v("$preHost")]),t._v("： 上游微服务的Host Name")]),t._v(" "),e("p",[e("code",[t._v("$preIp")]),t._v("：上游微服务的IP地址")]),t._v(" "),e("p",[e("code",[t._v("$spanId")]),t._v("：链路spanId，具体规则可以参照"),e("code",[t._v("八.SpanId生成规则")])]),t._v(" "),e("p",[e("code",[t._v("$traceId")]),t._v("：全局唯一跟踪ID")]),t._v(" "),e("p",[t._v("这样日志的打印就能按照你定义模板进行打印")])])}),[],!1,null,null,null);e.default=s.exports}}]);