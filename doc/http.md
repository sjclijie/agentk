<!-- @rev 92b94cc2929a376ddb5af60f1e40807e 20ae7b -->
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
### Headers()

```js
function Headers(headers) 
```


 Headers represents a set of name-value pairs which will be used in:
  - client request object
  - remote server response
  - server request event


**Params**

  - headers(optional) `object`
    <br>initial name-value map of headers
     


------------------------------------------------------------------------
### append()

```js
function Headers::append(name, value) 
```


 Appends an entry to the object.


**Params**

  - name `string`
  - value `string`


------------------------------------------------------------------------
### set()

```js
function Headers::set(name, value) 
```


 Sets a header to the object.


**Params**

  - name `string`
  - value `string`


------------------------------------------------------------------------
### ["delete"]()

```js
function Headers::["delete"](name) 
```


 Deletes all headers named `name`


**Params**

  - name `string`


------------------------------------------------------------------------
### forEach()

```js
function Headers::forEach(cb) 
```


 cb will be called with 3 arguments: value, name, and this Headers object


**Params**

  - cb `function`


------------------------------------------------------------------------
### get()

```js
function Headers::get(name) 
```


 Returns the value of an entry of this object, or null if none exists.

 The first will be returned if multiple entries were found.


**Params**

  - name `string`

**Returns**

> {null|string}
     

------------------------------------------------------------------------
### getAll()

```js
function Headers::getAll(name) 
```


 Returns All values of this object with the name


**Params**

  - name `string`

**Returns**

> {Array}
     

------------------------------------------------------------------------
### has()

```js
function Headers::has(name) 
```


 Returns whether an entry of the name exists


**Params**

  - name `string`

**Returns**

> {boolean}
     

------------------------------------------------------------------------
### entries()

```js
function Headers::entries() 
```


 Returns an iterator that yields name-value pair of all entries


**Returns**

> {Iterator}
     

------------------------------------------------------------------------
### keys()

```js
function Headers::keys() 
```


 Returns an iterator that yields names of all entries


**Returns**

> {Iterator}
     

------------------------------------------------------------------------
### values()

```js
function Headers::values() 
```


 Returns an iterator that yields values of all entries


**Returns**

> {Iterator}
     

------------------------------------------------------------------------
### [Symbol.iterator]()

```js
function Headers::[Symbol.iterator]() 
```


 Returns an iterator that yields name-value pair of all entries


**Returns**

> {Iterator}
     

------------------------------------------------------------------------
### Body()

```js
function Body(body) 
```


 Abstract class for http request/response entity


**Params**

  - body `string|Buffer|ArrayBuffer|node.stream::stream.Readable`


------------------------------------------------------------------------
### text()

```js
function Body::text() 
```




**Returns**

> {Promise} a promise that yields the request payload as a string
     

------------------------------------------------------------------------
### json()

```js
function Body::json() 
```




**Returns**

> {Promise} a promise that yields the request payload as a JSON object
     

------------------------------------------------------------------------
### arrayBuffer()

```js
function Body::arrayBuffer() 
```




**Returns**

> {ArrayBuffer} a promise that yields the request payload as an ArrayBuffer
     

------------------------------------------------------------------------
### buffer()

```js
function Body::buffer() 
```




**Returns**

> {Promise} a promise that yields the request payload as a Buffer
     

------------------------------------------------------------------------
### stream()

```js
get Body::stream() 
```




**Returns**

> {node.stream::stream.Readable} a readable stream
     

------------------------------------------------------------------------
### Request()

```js
function Request(url, options) 
```


 A `Request` is an representation of a client request that will be sent to a remote server, or a server request
 that received from the remote client.


**Params**

  - url `string`
    <br>a remote url
  - options(optional) `object`
    <br>optional arguments, which contains any of:

   - method `String`: request method, e.g., "GET" or "POST"
   - headers `object|Headers` request headers
   - body `string|Buffer|ArrayBuffer|node.stream::stream.Readable` request payload to be sent or received


**Returns**

> {Request}
     

------------------------------------------------------------------------
### method()

```js
get Request::method() 
```




**Returns**

> {string} request method, e.g., `"GET"` `"POST"`
     

------------------------------------------------------------------------
### url()

```js
get Request::url() 
```




**Returns**

> {string} request uri, like `"http://www.example.com/test?foo=bar"`
     

------------------------------------------------------------------------
### headers()

```js
get Request::headers() 
```




**Returns**

> {Headers} request headers
     

------------------------------------------------------------------------
### scheme()

```js
get Request::scheme() 
```



**Returns**

> {String} request scheme, like `"http:"`
     

------------------------------------------------------------------------
### host()

```js
get Request::host() 
```



**Returns**

> {String} request host, like `"www.example.com:80"`
     

------------------------------------------------------------------------
### hostname()

```js
get Request::hostname() 
```



**Returns**

> {String} request hostname, like `"www.example.com"`
     

------------------------------------------------------------------------
### port()

```js
get Request::port() 
```



**Returns**

> {String} request port, like `"80"`
     

------------------------------------------------------------------------
### pathname()

```js
get Request::pathname() 
```



**Returns**

> {String} request pathname, like `"/test"`
     

------------------------------------------------------------------------
### originalPathname()

```js
get Request::originalPathname() 
```




------------------------------------------------------------------------
### pathname()

```js
set Request::pathname(pathname) 
```




**Params**

  - pathname `String`


------------------------------------------------------------------------
### search()

```js
get Request::search() 
```



**Returns**

> {String} request search string, like `"?foo=bar"`
     

------------------------------------------------------------------------
### query()

```js
get Request::query() 
```



**Returns**

> {object} request query key-value map, like `{foo:"bar"}`
     

------------------------------------------------------------------------
### cookies()

```js
get Request::cookies() 
```



**Returns**

> {object} request cookies
     

------------------------------------------------------------------------
### Response()

```js
function Response(body, options) 
```


 A `Response` is an representation of a server response that will be sent to a remote client, or a client response
 that received from the remote server.

 Additional fields can be used to manuplate the response object, which are:

   - response.status `number`: status code of the response
   - response.statusText `number`: status text of the response


**Params**

  - body(optional) `string|Buffer|ArrayBuffer|node.stream::stream.Readable`
  - options(optional) `object`
    <br>optional arguments,  which contains any of:

   - status `number`: The status code for the reponse, e.g., 200.
   - statusText `string`: The status message associated with the staus code, e.g., OK.
   - headers `object|Headers`: the response headers
     


------------------------------------------------------------------------
### ok()

```js
get Response::ok() 
```



**Returns**

> {boolean}
     

------------------------------------------------------------------------
### headers()

```js
get Response::headers() 
```




**Returns**

> {Headers} response headers
     

------------------------------------------------------------------------
### setCookie()

```js
function Response::setCookie(name, value, options) 
```


 Adds Set-Cookie header to the response object


**Params**

  - name `string`
    <br>cookie name to be set
  - value `string`
    <br>cookie value to be set
  - options(optional) `object`
    <br>optional keys to be appended, which can contain any of `expires`, `domain`, `path` etc.
     


------------------------------------------------------------------------
### error()

```js
function Response.error(status, reason) 
```


 Creates an error response


**Params**

  - status `number`
  - reason `Error|string|Buffer`
    <br>message of the error as the response body
     


------------------------------------------------------------------------
### json()

```js
function Response.json(obj) 
```


 Creates a json response, a `content-type` header will be added to the headers


**Params**

  - obj
    <br>data to be sent

**Returns**

> {Response}
     

------------------------------------------------------------------------
### redirect()

```js
function Response.redirect(url) 
```


 Creates a redirect response, the status will be set to 302, and a `location` header will be added


**Params**

  - url `string`
    <br>redirect url, e.g. 'http://www.example.com' or '/foo/bar'

**Returns**

> {Response}
     

------------------------------------------------------------------------
### file()

```js
function Response.file(file) 
```




------------------------------------------------------------------------
### listen()

```js
function listen(port, cb, host, backlog) 
```


 Create a new http server, bind it to a port or socket file. A callback is supplied which accepts a
 [`Request`](#class-Request) object as parameter and returns a [`Response`](#class-Response)

 There are some extra properties that can be accessed with the `req` object:

   - req.request [`http.IncomingMessage`](https://nodejs.org/api/http.html#http_http_incomingmessage) original request object
   - req.response [`http.ServerResponse`](https://nodejs.org/api/http.html#http_class_http_serverresponse) original response object
   - req.originalUrl `string` request's original url, should not be overwritten


**Params**

  - port `number|string`
    <br>TCP port number or unix domain socket path to listen to
  - cb `function|router::Router`
    <br>request handler callback
  - host(optional) `string`
    <br>hostname to listen to, only valid if port is a 0-65535 number
  - backlog(optional) `number`
    <br>maximum requests pending to be accepted, only valid if port is a 0-65535 number

**Returns**

> {node.http::http.Server} returned after the `listening` event has been fired
 

------------------------------------------------------------------------
### fetch()

```js
function fetch(url, options) 
```


 Compose a http request.
 `fetch` has two prototypes:

   - function fetch(request:[Request](#class-Request))
   - function fetch(url:string, options:object)

 Please refer to the [Request](#class-Request) constructor for the info of the arguments

**Params**

  - url `string`
  - options `object`


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
 
