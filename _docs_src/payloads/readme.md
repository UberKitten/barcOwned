# Payloads

A payload is a collection of strings containg text and commands to be injected into a target host.

## File structure

|    Key    |    Type  |         Description        |
|      -    |     -    |              -             |
|    name   |  String  |  Payload name, used in UI  |
|  payload  |   Array  |      Strings to inject     |

Each string in the `payload` array may optionally include *up to **one***
string to be match against a rule that you have created using a [setup script](../setup-scripts/readme.md)

## Creating a payload

Create a new `.json` file in the `scanner-paylaods` directory for your payload

Set the `name` key to a name for the payload in the interface

Add your series of strings, optionally with commands (see note above)

### Manifest

Next, create a `manifest.json` file in the `scanner-paylaods` directory

This file just contains the names of your payload files, like this

```
[
  "run-calc.json",
  "another-payload.json"
]
```

It will be automatically loaded by the interface, where you will be able
to choose which payload to use
