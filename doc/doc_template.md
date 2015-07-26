<!-- @rev <%- checksum %> <%- tpl_checksum %> -->
# <%= namespace %>
<% if(meta && meta.title) {%>
<%=meta.title%>
<%}%>
----

<% if (meta) {%><%= meta.description %><%}%>

<% if(consts.length) {%>
## Constant Fields
<% consts.forEach(function(obj) {var comment = obj.comment; %>
### <%- obj.name %>
<%= comment.description %>
<% if(comment.type) {%>  #### type
<%- comment.type %><%}%>
<% if(obj.value) {%>  #### value
`<%- obj.value %>`<%}%>
<%})%>
<%}

if(variables.length) {%>
## Variable Fields
<% variables.forEach(function(obj) {var comment = obj.comment; %>
### <%- obj.name %>
<%= comment.description %>
<% if(comment.type) {%>#### type
<%- comment.type %>
<%}%>
<% if(obj.value) {%>#### value
`<%- obj.value %>`
<%}%>
<%})%>
<%}

if(methods.length) {%>
## Methods
<% methods.forEach(function(method) {var comment = method.comment;%>
------------------------------------------------------------------------
### <%- method.name %>()

```js
<%- method.prototype %>
```

<%= comment.description %>

<% if (comment.param) {%>**Params**
<% comment.param.forEach(function(param){var m = /^\{(.*?)\}\s*(\w+)\s*(.*)/.exec(param); %>
  - <%- m[2]%><% if(m[1]) {%> `<%- m[1]%>`<%}%><%if(m[3]) {%>
    <br><%= m[3]%><%}
})%>

<%}
if(comment.returns) {%>**Returns**

> <%- comment.returns%>
<%}
})
}

if(_default) {%>
## Module default
<%}%>