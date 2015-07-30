<!-- @rev 1d07f5049786c74fbf3996956c4edd49 215fda -->
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

  - stream `node.stream::stream.Readable`

**Returns**

> {node.stream::stream.Readable}
 

------------------------------------------------------------------------
### gunzipTransform()

```js
function gunzipTransform(stream) 
```


 transforms a gzipped stream into an unzipped stream


**Params**

  - stream `node.stream::stream.Readable`

**Returns**

> {node.stream::stream.Readable}
 
