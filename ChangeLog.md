- The start.sh and stop.sh scripts now use a pid file to make sure that the
  correct process is stopped.
- You can now set the plugin, theme and editions paths in the config instead of
  using environment variables
- Add the option to make a wiki publicly viewable without logging in
- Add owners to wikis. Owners have special permissions that give them view,
  edit and unloadWiki privileges.
- Wikis created from within Bob now have the correct default permissions set.
  - They can be set as public or private using the create wiki thing in Bob
  - The owner of the wiki is set to the person whose token is used to send the
    message. This means that they have immediate access to the wiki without any
    restarts.
