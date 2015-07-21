<!-- @rev 330f1b3292cec9e01e980121d77accc6 -->
# zlib

----




## Methods

------------------------------------------------------------------------
### gzip()

```js
function gzip(buffer) 
```


 convert a buffer into a gzipped buffer


**Params**

  - buffer `Buffer`

**Returns**

> {Buffer}
 

------------------------------------------------------------------------
### gzipTransform()

```js
function gzipTransform(stream) 
```


 transforms a stream into a gzipped stream


**Params**

  - stream `net.Stream`

**Returns**

> {net.Stream}
 

------------------------------------------------------------------------
### gunzipTransform()

```js
function gunzipTransform(stream) 
```


 transforms a gzipped stream into an unzipped stream


**Params**

  - stream `net.Stream`

**Returns**

> {net.Stream}
 
