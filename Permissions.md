# Explain the permissions!!

There are two levels of permissions, the wiki permissions that are per-wiki and
the overall permissions that are for sysadmin type things.

## Wiki Permissions

There are three types of permissions for wikis. These can be set per-person or
per-group for each wiki. Note: These are independent. You can give a person
edit permissions without giving them view permissions if you have some reason
to.

- `view` - the person can view the wiki.
- `edit` - the person can make changes to the wiki.
- `admin` - the person can make changes to the wiki settings, make new wikis, make
single file wikis from all or some of the wikis tiddler, stop the wiki server
- `script` - the person can use the wiki to trigger shell scripts

A wiki has an owner. The owner always has view, edit and admin permissions.

The `Guest` login can never have admin or script permissions and can never own a
wiki.

## Admin Permissions

These permissions are for setting ownership and permissions.

What do they need to be?

These allow a person to change the wiki permissions. The owner can always set
the view, edit, and admin levels of their own wiki.
