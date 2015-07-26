<!-- @rev 036378a3f54a2dbb9613ec395b24cd22 015c35 -->
# http_response

Wrapper class for http response, and basic methods to construct a response.

 This module contains a class named `HttpResponse` representing
 

----




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




**Returns**

> {HttpResponse}

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




------------------------------------------------------------------------
### ok()

```js
function ok() 
```




------------------------------------------------------------------------
### redirect()

```js
function redirect(url) 
```



