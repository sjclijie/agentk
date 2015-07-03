###-begin-agentk-completion-###
#
# agentk command completion script
#
# Installation: agentk completion >> ~/.bashrc  (or ~/.zshrc)
# Or, maybe: agentk completion > /usr/local/etc/bash_completion.d/agentk
#

COMP_WORDBREAKS=${COMP_WORDBREAKS/=/}
COMP_WORDBREAKS=${COMP_WORDBREAKS/@/}
export COMP_WORDBREAKS

if type complete &>/dev/null; then
  _agentk_completion () {
    local si="$IFS"
    IFS=$'\n' COMPREPLY=($(COMP_CWORD="$COMP_CWORD" \
                           COMP_LINE="$COMP_LINE" \
                           COMP_POINT="$COMP_POINT" \
                           agentk completion -- "${COMP_WORDS[@]}" \
                           2>/dev/null)) || return $?
    IFS="$si"
  }
  complete -o default -F _agentk_completion agentk
elif type compdef &>/dev/null; then
  _agentk_completion() {
    local si=$IFS
    compadd -- $(COMP_CWORD=$((CURRENT-1)) \
                 COMP_LINE=$BUFFER \
                 COMP_POINT=0 \
                 agentk completion -- "${words[@]}" \
                 2>/dev/null)
    IFS=$si
  }
  compdef _agentk_completion agentk
elif type compctl &>/dev/null; then
  _agentk_completion () {
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
                       agentk completion -- "${words[@]}" \
                       2>/dev/null)) || return $?
    IFS="$si"
  }
  compctl -K _agentk_completion agentk
fi
###-end-agentk-completion-###
