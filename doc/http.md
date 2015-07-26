<!-- @rev 97e5ed7c9c920470ad60773d8f6c59da a1202b -->
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
 `[http request](https://nodejs.org/api/http.html#http_http_incomingmessage)` object as
 parameter and returns a `[HttpResponse](http_response.html#HttpResponse)`


**Params**

  - port `number|string`
    <br>TCP port number or unix domain socket path to listen to
  - cb `function|router::Router`
    <br>request handler callback

**Returns**

> {node.http::http_Server}
 

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



