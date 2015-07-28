<!-- @rev 1b7c8907bb8a544e62dfcbe367009771 a1202b -->
# legacy

Legacy support module
 

----


 Converts some popular code styles into AgentK style.



## Methods

------------------------------------------------------------------------
### middleware()

```js
function middleware(cb) 
```


 Wrap an connect/express style middleware into AgentK route handler


**Params**

  - cb
    <br>middleware callback with 3 arguments:

   1. req: request object
   2. res: response object
   3. next: called on success or failed


**Returns**

> {function}
 
