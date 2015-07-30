<!-- @rev 51c95394e133a005b2fb8a0032a8a1b5 a1202b -->
# q_watcher

Qunar Watcher module
 

----


 Helper for using [Watcher](http://watcher.corp.qunar.com/).

 This module helps pushing monitor data to watcher system.



## Methods

------------------------------------------------------------------------
### recordOne()

```js
function recordOne(name, time) 
```


 Increase a record&#39;s count by 1, a time can be supplied


**Params**

  - name `string`
    <br>last name of the monitor record
  - time `number`
    <br>optional, time of the monitor record
 


------------------------------------------------------------------------
### recordSize()

```js
function recordSize(name, number) 
```


 Set a record&#39;s number


**Params**

  - name `string`
    <br>last name of the monitor record
  - number `number`
    <br>number to be set to
 


------------------------------------------------------------------------
### incrRecord()

```js
function incrRecord(name, count) 
```


 Increase a record&#39;s count by a varible number


**Params**

  - name `string`
    <br>last name of the monitor record
  - count `number`
    <br>value to be increased
 


------------------------------------------------------------------------
### listen()

```js
function listen(port) 
```


 start background web service


**Params**

  - port `number`
    <br>HTTP port number to listen to
 

