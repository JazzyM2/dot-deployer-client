# Developer Documentation

**#1** - Add Your Repository to Deployer

*give your team's Github Application access to your repository*

![setup-add-repo](setup.png)

## 2. Add .deployer File
*add a .deployer file in your master branch with metadata to tell the desktop client how to install your tool.  Please see below for more information on available schemas!*

![repository-contents](contents.png)

## 3. Create Releases
*Dot Deployer will see the releases in your repository and use their metadata to generate available downloads*

![releases](releases.png)

## 4. Test Installing & Uninstalling
*admins on the desktop client will see repositories that the GitHub Application is installed on, whether or not they have been released to users.  Tools available for release are marked with a **yellow rocket***

![setup-test-tool](test.gif)

## 5. Release to Users
*release a tool to users by clicking the yellow rocket next to it, or, unrelease a tool by clicking the red trashcan*

![administer](release.gif)

## .deployer File Schemas
***Version 3.0.0** of the .deployer Schema is documented below.  The **version** tag in your .deployer file tells Dot Deployer which schema you are using.  All assets are downloaded into the TEMP folder and then processed based on the configuration of the .deployer file*

```json
[{
  "version": "3.0.0",
  "schema": {
    "type": "object",
    "properties": {
      "version": {
        "type": "string",
        "required": true
      },
      "processes": {
        "type": "array",
        "required": false,
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "required": true
            }
          },
          "additionalProperties": false
        }
      },
      "urls": {
        "type": "object",
        "required": false,
        "properties": {
          "documentation": {
            "type": "string",
            "required": false
          },
          "support": {
            "type": "string",
            "required": false
          },
          "feedback": {
            "type": "string",
            "required": false
          }
        },
        "additionalProperties": false
      },
      "install": {
        "type": "array",
        "required": true,
        "items": {
          "type": "object",
          "required": true,
          "properties": {
            "action": {
              "type": "string",
              "required": true,
              "enum": ["run", "copy"]
            },
            "destination": {
              "type": "string",
              "required": false
            },
            "source": {
              "required": true,
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      },
      "uninstall": {
        "type": "array",
        "required": true,
        "items": {
          "type": "object",
          "required": true,
          "properties": {
            "action": {
              "type": "string",
              "required": true,
              "enum": ["run", "delete"]
            },
            "source": {
              "required": true,
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      },
      "dependson": {
        "type": "array",
        "required": false,
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            }
          }
        }
      }
    },
    "additionalProperties": false
  }
}]
```

## Examples
***Note:** the desktop client will **validate your .deployer file** when you attempt to **install** or **uninstall** the tool, and will **identify any errors** as necessary*

### Example 1: Dot Deployer
*this .deployer file will:*
1. run a file named **run.bat** after all assets in the release are downloaded (assets=true)

***Note:** this is the .deployer file the deployer application uses to install itself.  In this case, there are two assets in the release: a **run.bat** file and an **installer.exe**.  There is a quick script in the .bat file to launch the installer: **START %TEMP%\installer.exe**.*

```json
{
  "version": "2.0.0",
	"autoupdate": true,
  "assets": true,
	"install": [
		{
			"action": "run",
			"source": "run.bat"
		}
	]
}
```
