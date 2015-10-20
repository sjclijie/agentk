<!-- @rev 4db4e820cab88931a9106dffde37b65e 20ae7b -->
# wechat

----


 WeChat module



## Constant Fields

### SCOPE_BASE

  #### type
{string}
  #### value
`'snsapi_base'`

### SCOPE_USERINFO

  #### type
{string}
  #### value
`'snsapi_userinfo'`


## Variable Fields

### token

#### type
{string}

#### value
`''`



## Methods

------------------------------------------------------------------------
### addMessageReceiver()

```js
function addMessageReceiver(name, userid, appid, secret, encodingKey) 
```




------------------------------------------------------------------------
### messageFilter()

```js
function messageFilter(req) 
```




------------------------------------------------------------------------
### respondText()

```js
function respondText(req, text) 
```




------------------------------------------------------------------------
### respondNews()

```js
function respondNews(req, news) 
```




------------------------------------------------------------------------
### generateGrantCodeUrl()

```js
function generateGrantCodeUrl(name, redirect_url, scope, state) 
```




**Params**

  - name `String`
    <br>receiver name
  - redirect_url `String`
  - scope(optional) `String`
    <br>SCOPE_BASE or SCOPE_USERINFO
  - state(optional) `String`
    <br>defaults to '0'

**Returns**

> {Response}
 

------------------------------------------------------------------------
### grantCode()

```js
function grantCode(name, redirect_url, scope, state) 
```




------------------------------------------------------------------------
### getBaseInfo()

```js
function getBaseInfo(name, code) 
```




------------------------------------------------------------------------
### getUserInfo()

```js
function getUserInfo(access_token, openid) 
```



