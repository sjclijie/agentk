<!-- @rev 19f678c6330bb248faecef3b14def6b5 -->
# http_response

----




## Variable Fields

### gzip_min_body_len
minimum body length to enable gzip. Responses that have payload less that that size will not be gzipped.
#### type
{number}

#### value
`1024`



## Methods

### HttpResponse

```js
function HttpResponse() 
```



### handler

```js
function handler(fun) 
```
#### params

  - {function} fun

#### returns
{HttpResponse}


### data

```js
function data(buffer) 
```
#### params

  - {string|Buffer} buffer

#### returns
{HttpResponse}


### error

```js
function error(code, reason) 
```
#### params

  - {number} code

  - {Error|string} reason



### json

```js
function json(json) 
```



### stream

```js
function stream(stream) 
```



### file

```js
function file(file) 
```



### ok

```js
function ok() 
```



### redirect

```js
function redirect(url) 
```



