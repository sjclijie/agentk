<!-- @rev ae1f55684d7a602af22a2dc07b3c465b 20ae7b -->
# crypto

----




## Methods

------------------------------------------------------------------------
### md5()

```js
function md5(buf, format) 
```




------------------------------------------------------------------------
### sha1()

```js
function sha1(buf, format) 
```




------------------------------------------------------------------------
### hmac_sha1()

```js
function hmac_sha1(secret, buf, format) 
```




------------------------------------------------------------------------
### cipher()

```js
function cipher(method, secret, input, padding) 
```




**Params**

  - method `string`
    <br>see `require('crypto').getCiphers()`
  - secret `string|buffer`
    <br>secret key
  - input `string|Buffer`
    <br>plain text
  - padding(optional) `boolean`
    <br>whether auto padding is used, defaults to false

**Returns**

> {Buffer}
 

------------------------------------------------------------------------
### cipheriv()

```js
function cipheriv(method, key, iv, input, padding) 
```




**Params**

  - method `string`
    <br>see `require('crypto').getCiphers()`
  - key `string`
    <br>secret key
  - iv `string`
    <br>initial vector
  - input `string|Buffer`
    <br>plain text
  - padding(optional) `boolean`
    <br>whether auto padding is used, defaults to false

**Returns**

> {Buffer}
 

------------------------------------------------------------------------
### decipher()

```js
function decipher(method, secret, input, padding) 
```




**Params**

  - method `string`
    <br>see `require('crypto').getCiphers()`
  - secret `string|buffer`
    <br>secret key
  - input `string|Buffer`
    <br>cipher text
  - padding(optional) `boolean`
    <br>whether auto padding is used, defaults to false

**Returns**

> {Buffer}
 

------------------------------------------------------------------------
### decipheriv()

```js
function decipheriv(method, key, iv, input, padding) 
```




**Params**

  - method `string`
    <br>see `require('crypto').getCiphers()`
  - key `string`
    <br>secret key
  - iv `string`
    <br>initial vector
  - input `string|Buffer`
    <br>cipher text
  - padding(optional) `boolean`
    <br>whether auto padding is used, defaults to false

**Returns**

> {Buffer}
 
