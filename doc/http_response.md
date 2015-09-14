<!-- @rev b5b5c7be5b6fc3e8f785700b83f88e9e 20ae7b -->
# http_response

Wrapper class for http response, and basic methods to construct a response.

 

----


 This module contains a class named `HttpResponse` representing a response to a http request.



## Variable Fields

### gzip_min_body_len

 minimum body length to enable gzip. Responses that have payload less that that size will not be gzipped.

#### type
{number}
 

#### value
`1024`



## Methods

------------------------------------------------------------------------
### HttpResponse()

```js
function HttpResponse() 
```


 Creates a new http response object that has default status of 200


**Returns**

> {HttpResponse}

------------------------------------------------------------------------
### setStatus()

```js
function HttpResponse::setStatus(status) 
```


 Sets the status, returns the response object itself.


**Params**

  - status `number`

**Returns**

> {HttpResponse}
     

------------------------------------------------------------------------
### setHeaders()

```js
function HttpResponse::setHeaders(headers) 
```


 Bulk sets response headers, returns the response object itself.



**Params**

  - headers `object`
    <br>key-value pair of headers to be set

**Returns**

> {HttpResponse}
     

------------------------------------------------------------------------
### setHeader()

```js
function HttpResponse::setHeader(key, val) 
```


 Sets response header, returns the response object itself.


**Params**

  - key `string`
    <br>header name to be set
  - val `string|Array`
    <br>header value to be set

**Returns**

> {HttpResponse}
     

------------------------------------------------------------------------
### setCookie()

```js
function HttpResponse::setCookie(name, value, options) 
```


 Adds Set-Cookie header to the response object, returns it itself.


**Params**

  - name `string`
    <br>cookie name to be set
  - value `string`
    <br>cookie value to be set
  - options(optional) `object`
    <br>optional keys to be appended, which can contain any of `expires`, `domain`, `path` etc.


**Returns**

> {HttpResponse}
     

------------------------------------------------------------------------
### enableGzip()

```js
function HttpResponse::enableGzip() 
```


 Enables gzipped output, returns the response object itself.


**Returns**

> {HttpResponse}
     

------------------------------------------------------------------------
### handle()

```js
function HttpResponse::handle(req, res) 
```


 handle method to be overridden which yields output to the ServerResponse object.
 The response status and headers are auto set to the ServerResponse object, so what
 you need to do is write some data and end the response.


**Params**

  - req `node.http::http.IncomingMessage`
    <br>the original request object
  - res `node.http::http.ServerResponse`
    <br>the response object
     


------------------------------------------------------------------------
### handler()

```js
function handler(fun) 
```


 create a HttpResponse that works with a handler


**Params**

  - fun `function`

**Returns**

> {HttpResponse}
 

------------------------------------------------------------------------
### data()

```js
function data(buffer) 
```


 create a HttpResponse that sends some data to the client


**Params**

  - buffer `string|Buffer`

**Returns**

> {HttpResponse}
 

------------------------------------------------------------------------
### error()

```js
function error(code, reason) 
```


 create a HttpResponse that responds a error

**Params**

  - code `number`
    <br>The status code of the error response
  - reason `Error|string`
    <br>The extra message as the response payload

**Returns**

> {HttpResponse}
 

------------------------------------------------------------------------
### json()

```js
function json(json) 
```


 create a HttpResponse that responds a json, The following header will be set:

    Content-Type: application/json


**Params**

  - json `*`
    <br>Data to be sent

**Returns**

> {HttpResponse}
 

------------------------------------------------------------------------
### stream()

```js
function stream(stream) 
```


 create a HttpResponse that responds a json, The following header will be set:



**Params**

  - json `*`
    <br>Data to be sent

**Returns**

> {HttpResponse}
 

------------------------------------------------------------------------
### file()

```js
function file(file) 
```


 create a HttpResponse that responds a local file. The local file should be present and readable,
 otherwise empty response will be sent and no error is reported.


**Params**

  - file
    <br>local file path

**Returns**

> {HttpResponse}
 

------------------------------------------------------------------------
### ok()

```js
function ok() 
```


 create a empty response with status code 200.


**Returns**

> {HttpResponse}
 

------------------------------------------------------------------------
### redirect()

```js
function redirect(url) 
```


 create a redirect response

**Params**

  - url
    <br>redirection url
 

