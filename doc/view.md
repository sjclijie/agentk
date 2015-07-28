<!-- @rev 2a428f613f3c442bea01e57c0c8a7b81 a1202b -->
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
 




## Methods

------------------------------------------------------------------------
### render()

```js
function render(name, locals) 
```


 render a template file into response content, returns a `HttpResponse`.
 User should specify content type if needed.


**Params**

  - name
    <br>template name, with or without extension
  - locals
    <br>local bindings

**Returns**

> {HttpResponse}
 
