<!-- @rev 90379fed9153c08dd945d7f73b383d62 20ae7b -->
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

   - no_cache:`boolean` disable file cache, default to false
   - expires:`number` duration before expiration in ms, default to 0
   - cached:`number` file modification check iteration in ms, default to 3s
   - gzip:`boolean` enable gzip, default to true
   - gzip_min_len:`number` mininum length of file to be gzipped, default to 1K


**Returns**

> {function} router handle
 

## Module default
