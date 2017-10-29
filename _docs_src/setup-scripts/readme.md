# Setup Scripts

A setup script modifies the configuration of the barcode scanner and allows
you to set up rules before injecting a payload.

## File structure

|        Key      |    Type  |           Description         |
|         -       |     -    |                -              |
|       name      |  String  |    Script name, used in UI    |
|       setup     |  Object  |                               |
|  setup.options  |   Array  |  Options to enable on scanner |
|     setup.adf   |   Array  |  Rules to install on scanner  |

`setup.options` is an array of strings

`setup.adf` contains an array of rules to install

### Rule structure

Each rule has two keys, `criteria` and `actions`

The `criteria` contains an array of criteria to match on in the format

```
["stringatstart", "`1"]
```

where the first element is the match type and second is the string to match on

## Creating a setup script

Create a new `.json` file in the `scanner-setup-scripts` directory for your script

Set the `name` key to a name for the script in the interface

Add your rules to be used with your [payload](../payloads/readme.md)

### Manifest

Next, create a `manifest.json` file in the `scanner-setup-scripts` directory

This file just contains the names of your payload files, like this

```
[
  "run-cmd.json",
  "another-script.json"
]
```

It will be automatically loaded by the interface, where you will be able
to choose which script to use
