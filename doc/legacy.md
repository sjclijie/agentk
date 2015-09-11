<!-- @rev 87fbe823838a79c888163a43cc48d388 20ae7b -->
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
 
