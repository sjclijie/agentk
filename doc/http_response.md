<!-- @rev f3789db3f319781582083894fd392aeb 20ae7b -->
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
 

