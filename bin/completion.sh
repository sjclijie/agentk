###-begin-__CMD-completion-###
#
# __CMD command completion script
#
# Installation: __CMD completion >> ~/.bashrc  (or ~/.zshrc)
# Or, maybe: __CMD completion > /usr/local/etc/bash_completion.d/__CMD
#

COMP_WORDBREAKS=${COMP_WORDBREAKS/=/}
COMP_WORDBREAKS=${COMP_WORDBREAKS/@/}
export COMP_WORDBREAKS

if type complete &>/dev/null; then
  ___CMD_completion () {
    local si="$IFS"
    IFS=$'\n' COMPREPLY=($(COMP_CWORD="$COMP_CWORD" \
                           COMP_LINE="$COMP_LINE" \
                           COMP_POINT="$COMP_POINT" \
                           __CMD completion -- "${COMP_WORDS[@]}" \
                           2>/dev/null)) || return $?
    IFS="$si"
  }
  complete -o default -F ___CMD_completion __CMD
elif type compdef &>/dev/null; then
  ___CMD_completion() {
    local si=$IFS
    compadd -- $(COMP_CWORD=$((CURRENT-1)) \
                 COMP_LINE=$BUFFER \
                 COMP_POINT=0 \
                 __CMD completion -- "${words[@]}" \
                 2>/dev/null)
    IFS=$si
  }
  compdef ___CMD_completion __CMD
elif type compctl &>/dev/null; then
  ___CMD_completion () {
    local cword line point words si
    read -Ac words
    read -cn cword
    let cword-=1
    read -l line
    read -ln point
    si="$IFS"
    IFS=$'\n' reply=($(COMP_CWORD="$cword" \
                       COMP_LINE="$line" \
                       COMP_POINT="$point" \
                       __CMD completion -- "${words[@]}" \
                       2>/dev/null)) || return $?
    IFS="$si"
  }
  compctl -K ___CMD_completion __CMD
fi
###-end-__CMD-completion-###
