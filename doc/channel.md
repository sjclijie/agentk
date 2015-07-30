<!-- @rev 5b1b2f81d2000637df2a7babccb7bb43 215fda -->
# channel

cross process message gathering and dispatching system
 

----


 Channel can be used for cross process communication, in two modes:

   - provider and query mode: a process can query all pairs for a data, with a channel name
   - dispatcher and listener mode: a process can dispatch a message to all pairs, with a channel name



## Methods

------------------------------------------------------------------------
### registerProvider()

```js
function registerProvider(ch, cb, direct) 
```


 register a provider for [query](#query). when called by one child, all pairs will be queried and the result
 is returned as an array.

 `cb` is called inside coroutine if `direct` is set to false


**Params**

  - ch `string`
    <br>channel name to be queried
  - cb `function`
    <br>callback method to get the data
  - direct `boolean`
    <br>whether cb should run directly or inside coroutine, default to false
 


------------------------------------------------------------------------
### registerListener()

```js
function registerListener(ch, cb) 
```


 register a listener to dispatch

 `cb` is called outside coroutine


**Params**

  - ch `string`
    <br>channel name that listens to
  - cb `function`
    <br>callback method receive the dispatched data
 


------------------------------------------------------------------------
### query()

```js
function query(ch) 
```


 query all processes, get the data by the provider registered, and return them as an array

**Params**

  - ch `string`
    <br>channel name to be queried

**Returns**

> {Array} all results of the pairs that registered a provider for this channel
 

------------------------------------------------------------------------
### dispatch()

```js
function dispatch(ch, data) 
```


 dispatch a message to all processes

**Params**

  - ch `string`
    <br>channel to be dispatched
  - data
    <br>data to be dispatched, must be json serializable
 


------------------------------------------------------------------------
### onWorker()

```js
function onWorker(worker) 
```


 This method is called by daemon at worker start


**Params**

  - worker `node.child_process::ChildProcess`

