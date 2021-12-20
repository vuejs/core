@echo off
echo "--begin--"

git status

git pull

git add *

set now=%date% %time%

echo "Time:" %now%

git commit -m "%now%"

git push

echo "--end--"

pause