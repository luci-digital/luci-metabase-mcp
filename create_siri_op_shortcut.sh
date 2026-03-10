#!/bin/bash
# Note: In MacOS 12+ due to sandboxing, the "Shortcuts" CLI does not let you generate full .shortcut files programmatically via bash alone.
# The user must simply open the "Shortcuts" App natively.
echo "Open the 'Shortcuts' app on your Mac."
echo "1. Click '+' to create a new shortcut."
echo "2. Name it 'Authenticate Luci'."
echo "3. Add action: 'Run Shell Script'."
echo "4. Set the script content to:"
echo "   export PATH=\"/usr/local/bin:/opt/homebrew/bin:\$PATH\""
echo "   op signin --account lucidigital"
echo "5. Now you can say 'Hey Siri, Authenticate Luci'."
