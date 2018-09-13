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
- `admin` - the person can make changes to the wiki settings, make new wikis,
  make single file wikis from all or some of the wikis tiddler, stop the wiki
  server
- `script` - the person can use the wiki to trigger shell scripts
- `owner` - reserved for only the owner of the wiki. It grants the same
  privlidges as `view` and `edit` in addition to the `unloadWiki` message.
- `upload` - a special privlidge that lets you upload non-tiddler files (like
  media files)

A wiki has an owner. The owner always has view, edit and admin permissions.

The `Guest` login can never have admin or script permissions and can never own a
wiki.

## Admin Permissions

These permissions are for setting ownership and permissions.

What do they need to be?

`Guest` - logged in as a guest
`Normal` - logged in with a normal name and password
`Admin` - logged in as an administrator

So far we have `Guest` who isn't allowed to change any wiki permissions unless
they own a wiki and `Admin` who can change any wiki permissions.

But without the utilities to change the permissions they don't mean much.
