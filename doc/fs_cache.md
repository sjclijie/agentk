<!-- @rev 4a94093feb23aed9dbf214f79dcf61d1 20ae7b -->
# fs_cache

file system cache handler
 

----


 This module helps read and parse file by caching the result and automatically determine whether or not the file
 content should be read and parsed again.



## Methods

------------------------------------------------------------------------
### fs_cache()

```js
function fs_cache(option) 
```




**Params**

  - option(optional) `object`
    <br>optional arguments:

   - cached:`number` file modification check iteration in ms, default to 3s
   - handler:`string` file content handler


**Returns**

> {function} reader that accepts a filename and returns an object which contains the result
 

## Module default
