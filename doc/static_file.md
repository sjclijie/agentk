<!-- @rev 82feee2f68a634be3d3e62d972b7b068 20ae7b -->
# static_file

static file request handler
 

----





## Constant Fields

### mimeTypes

 filename extension to mime type map

  #### type
{object}
 



## Methods

------------------------------------------------------------------------
### staticFile()

```js
function staticFile(directory, option) 
```




**Params**

  - directory `string`
    <br>absolute path or relative to working directory
  - option(optional) `object`
    <br>optional arguments:

   - expires:`number` duration before expiration in ms, default to 0
   - cached:`number` file modification check iteration in ms, default to 3s
   - gzip:`boolean` enable gzip, default to true
   - gzip_min_len:`number` mininum length of file to be gzipped, default to 1K
   - hash_method:`function` method used to calculate etag
   - cache_capacity:`number` maximum of file cached, defaults to 300


**Returns**

> {function} router handle
 

## Module default
