<!-- @rev 991032b585723b4e4330e36a8c0df692 20ae7b -->
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



