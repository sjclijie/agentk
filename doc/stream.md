<!-- @rev 3db090ab46c7f5f70347cf11c27e8c02 20ae7b -->
# stream

utils for stream consumption
 

----




## Methods

------------------------------------------------------------------------
### read()

```js
function read(incoming) 
```


 Read stream's contents


**Params**

  - incoming `node.stream::stream.Readable`
    <br>stream to be read

**Returns**

> {Buffer} contents read
 

------------------------------------------------------------------------
### iterator()

```js
function iterator(incoming) 
```


 Create an iterator which yields when stream has contents available


**Params**

  - incoming `node.stream::stream.Readable`

**Returns**

> {Iterator} iterator which can be used in for...of
 
