<!-- @rev a3e955bf820ea5822b365b0c5a40d14e 20ae7b -->
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
 
