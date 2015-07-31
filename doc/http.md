<!-- @rev 35da296f800f3d5fc67761de9eda6b74 215fda -->
# http

----


 Wrapper for http server/client API.



## Constant Fields

### agent

 default agent for http request. You can set
 maximum socket per host when calling request

  #### type
{node.http::http.Agent}
 



## Variable Fields

### client_ua

 default User Agent for http request

#### type
{string}
 




## Methods

------------------------------------------------------------------------
### listen()

```js
function listen(port, cb) 
```


 Create a new http server, bind it to a port or socket file. A callback is supplied which accepts a
 [`http.IncomingMessage`](https://nodejs.org/api/http.html#http_http_incomingmessage) object as
 parameter and returns a [`HttpResponse`](http_response.html#HttpResponse)

 There are some extra properties that can be accessed with the `req` object:

   - req.pathname `string` request's pathname, could be overwritten by `Router.prefix` method
   - req.search `string` search string, looks like `?foo=bar`
   - req.query `object` key-value map of the query string
   - req.body `Buffer` request payload


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


 Create a http request, the

**Params**

  - options `object`
    <br>See [request](https://nodejs.org/api/http.html#http_http_request_options_callback) on Node.JS documentation.

 Available options are:

   - options.host `string` hostname to connect to
   - options.port `number` port number to connect to, default to `80`
   - options.socketPath `string` against host:port, use socketPath to create connection
   - options.method `string` request method, default to `"GET"`
   - options.path `string` request url pathname and query string, default to `"/"`
   - options.headers `object` request header names and values map
   - options.proxy `string|object` http proxy server, maybe string like: `"<user>:<password>@<host>:<port>"` or object with these keys

  - body `string|Buffer`
    <br>data to be sent to as payload, maybe null or undefined if there is no payload

**Returns**

> {node.http::http.ServerResponse} a response object that can be operated and read as a stream.
 

------------------------------------------------------------------------
### pipe()

```js
function pipe(options, stream) 
```


 Similar to [request](#request), but requires a `stream.Readable` object rather than a string/buffer as the request payload.


**Params**

  - options `object`
    <br>similar to [request](#request)
  - stream `node.stream::stream.Readable`
    <br>a readable stream

**Returns**

> {node.http::http.ServerResponse}
 

------------------------------------------------------------------------
### read()

```js
function read(incoming) 
```


 Read and return a `http.ServerResponse`'s body. Similar to `stream.read`, but it can handle gzipped response content.


**Params**

  - incoming `node.http::http.ServerResponse`
    <br>a server response

**Returns**

> {Buffer} response body
 

------------------------------------------------------------------------
### buildQuery()

```js
function buildQuery(obj) 
```


 Build a http query string from a key-value map


**Params**

  - obj `object`
    <br>keys and values

**Returns**

> {string} query string
 

------------------------------------------------------------------------
### parseQuery()

```js
function parseQuery(query) 
```


 Parse a http query string into a key-value map.
 May throw error if malformed UTF-8 escape sequence found


**Params**

  - query `string`
    <br>query string to be parsed

**Returns**

> {object} keys and values
 
