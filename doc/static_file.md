<!-- @rev 63a8c2d60b5cb1883749f5094a7e30d1 215fda -->
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
