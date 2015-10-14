<!-- @rev 7ab77c489a7a8c3e961bf4bcacfc700c 20ae7b -->
# view

----




## Constant Fields

### engines

 map of view engines, user can supply a specific view engine by assigning to this object

  #### type
{object}
 



## Variable Fields

### path

 directory of view template files (default to current directory)

#### type
{string}
 

#### value
`''`


### view_engine

 default view engine when no extension name is supplied
#### type
{string}
 

#### value
`'ejs'`


### module_loader

 method used to load view engine by extension, default to `require`. User can supply a specific loader by assigning
 this variable

#### type
{function}
 



### defaultMimeType

 Default mime type

#### type
{string}
 

#### value
`'text/html'`



## Methods

------------------------------------------------------------------------
### render()

```js
function render(name, locals, mimeType) 
```


 render a template file into response content, returns a `HttpResponse`.
 User should specify content type if needed.


**Params**

  - name `string`
    <br>template name, with or without extension
  - locals `object`
    <br>local bindings
  - mimeType(optional) `string`
    <br>custom mimeType, default to 'text/html'

**Returns**

> {http::Response}
 
