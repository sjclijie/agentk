<!-- @rev 22f651a3fd237893828e60404ae2e48e 20ae7b -->
# test

----




## Methods

------------------------------------------------------------------------
### run()

```js
function run(file) 
```


 Run a test script

**Params**

  - file `string`
    <br>pathname of a test script file
 


------------------------------------------------------------------------
### Test()

```js
function Test(name) 
```


 Unit test


**Params**

  - name `name`

**Returns**

> {Test}
 

------------------------------------------------------------------------
### IntegrationTest()

```js
function IntegrationTest(name, handle) 
```


 Integration test on a router handle that accepts a http request and returns a http response


**Params**

  - name `string`
  - handle `function|router::Router`

**Returns**

> {IntegrationTest}
 

------------------------------------------------------------------------
### summary()

```js
function summary() 
```



