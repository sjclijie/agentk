<!-- @rev f8bc4857ecbadab587d4113f0b334ddc 20ae7b -->
# logger

Logging helper


----


 Helper for log writing



## Constant Fields

### format

 formats of each log level.
 Some variables can be used in the log format:

   - `$level` current log level, like: `DEBUG INFO WARN ERROR FATAL`
   - `$datetime` datetime in format `yyyy-MM-dd HH:mm:ss`
   - `$filename` source file from which the logger method is called
   - `$line` line number of the source file from which the logger method is called
   - `$column` column number of the source file from which the logger method is called
   - `$method` method name from which the logger method is called
   - `$0` `$1` ... parameters to the log method
   - `$(xxxx)` js expression evaluated to get a field from a variable

 Format of the datetime parameter can be specified like: `$datetime{yyyy/MM/dd HH:mm:ss.SSS}`, tokens which can be
 used in the datetime formatter are:

   - `yyyy` 4-digits years, like 2015
   - `MM` 2-digits months, like 01, 02, ..., 12
   - `MMM` 3-characters month name, like Jan, Feb, ..., Dec
   - `dd` 2-digits date, like 01, 02, ..., 31
   - `DDD` 3-characters day name of week, like Sun, Mon, ..., Sat
   - `HH` 2-digits hours in 24-hours
   - `mm` 2-digits minutes
   - `ss` 2-digits seconds
   - `SSS` 3-digits milliseconds

 Default formats for each log levels are `&#39;[$level] $datetime $0\n&#39;`, which will print the log level, the datetime and the
 first argument.

 A log method should not be called before its format and output parameter is set up

  #### type
Object
 


### output

 Output targets

  #### type
Object
 specify a filename or a stream
 


### VERBOSE

  #### type
{number}
  #### value
`8`

### DEBUG

  #### type
{number}
  #### value
`7`

### INFO

  #### type
{number}
  #### value
`6`

### WARN

  #### type
{number}
  #### value
`4`

### ERROR

  #### type
{number}
  #### value
`3`

### FATAL

  #### type
{number}
  #### value
`0`


## Variable Fields

### level

 current log level. The log levels that has lower priority will be ignored.
#### type
{number}
 



### verbose

 log method that will format the arguments into a string and write them into output

#### type
{Function}
 



### debug

 log method that will format the arguments into a string and write them into output

#### type
{Function}
 



### info

 log method that will format the arguments into a string and write them into output

#### type
{Function}
 



### warn

 log method that will format the arguments into a string and write them into output

#### type
{Function}
 



### fatal

 log method that will format the arguments into a string and write them into output

#### type
{Function}
 



