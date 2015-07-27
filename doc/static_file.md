<!-- @rev 5abc27b8c636c50712431f683a131dbc a1202b -->
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
  - option `object`
    <br>optional parameters:

   - no_cache:`boolean` disable file cache, default to false
   - expires:`number` duration before expiration in ms, default to 0
   - cached:`number` file modification check iteration in ms, default to 3s
   - gzip:`boolean` enable gzip, default to false


**Returns**

> {function} router handle
 

## Module default
