<!-- @rev 79c7e374b9f774bb05d25b7f1bbdb99e 015c35 -->
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
 
