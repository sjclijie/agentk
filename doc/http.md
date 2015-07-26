<!-- @rev 27f3eb7cd947a1cc731f7b08d58f4c2b a1202b -->
# http

----


 Wrapper for http server/client API.



## Variable Fields

### maxSockets

 maximum socket per host when calling request

#### type
{number}
 

#### value
`5`



## Methods

------------------------------------------------------------------------
### listen()

```js
function listen(port, cb) 
```


 Create a new http server, bind it to a port or socket file. A callback is supplied which accepts a
 [`http.IncomingMessage`](https://nodejs.org/api/http.html#http_http_incomingmessage) object as
 parameter and returns a [`HttpResponse`](http_response.html#HttpResponse)


**Params**

  - port `number|string`
    <br>TCP port number or unix domain socket path to listen to
  - cb `function|router::Router`
    <br>request handler callback

**Returns**

> {node.http::http.Server}
 

------------------------------------------------------------------------
### request()

```js
function request(options, body) 
```




------------------------------------------------------------------------
### read()

```js
function read(incoming) 
```



